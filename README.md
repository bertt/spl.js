# spl.js

SpatiaLite and friends - sqlite, geos, proj, rttopo - for node (sync API) and browser (async API).

## Install

```bash
npm install spl.js@0.1.0-beta.0
```

The library for browsers bundles both the WebWorker script and the wasm file (~ 4MB). PROJ files (like proj.db) are not bundled but available from the `dist/proj` folder.

## Code Examples

---

### Browser: Simple Query

```js
import SPL from 'spl.js';
const db = await SPL().then(spl => spl.db());

console.assert(
    (await db.exec('select spatialite_version()').get.first) === '5.0.1'
);

db.exec('select ? as hello', ['spatialite']).get.objs
    .then(res => console.assert(res[0].hello === 'spatialite'))
    .catch(err => console.log(err));
```

### Browser: Import a GeoPackage

```js
import SPL from 'spl.js';
const spl = await SPL();

const london = await fetch('https://data.london.gov.uk/download/london_boroughs/9502cdec-5df0-46e3-8aa1-2b5c5233a31f/london_boroughs.gpkg')
    .then(response => response.arrayBuffer());

const db = await spl.mount('data', {
    buffers: [{ name: 'london', data: london}]
}).db()
    .exec('select enablegpkgamphibiousmode()')
    .attach('data/london', 'london');

const srid = await db.exec('select srid(geom) from london.london_boroughs').get.first;

console.assert(srid === 27700)
```

### Node: Handle JSON & GeoJSON automatically (parse, stringify, geometry blob to GeoJSON)

```js
const spl = require('spl.js');
const db = spl({
    autoGeoJSON: {
        precision: 0,
        options: 0
    }
}).db()

console.assert(
    db.exec('select json(@js)', { '@js': { hello: 'json' }}).get.first.hello === 'json'
);

console.assert(
    db.exec('select geomfromtext(?)', [ 'POINT(11.1 11.1)' ]).get.first.coordinates[0] === 11
);
```

### Node: Import a zipped Shapefile

```js
const spl = require('spl.js');
const db = spl().mount(__dirname + '/files/shp/').db();

console.assert(
    db.exec('select importzipshp($zip_path, $basename, $table, $charset) as count', {
        $zip_path: 'shp.zip',
        $basename: 'ne_110m_admin_0_countries',
        $table: 'shp',
        $charset: 'CP1252'
    }).get.first === 177
);
```

## Live Examples

---

Creating a Topology from a GeoPackage Layer and Simplify Polygon Boundaries. Be patient - spl.js needs to be fetched and building the topology will take a few seconds as well:

https://jvail.github.io/spl.js/examples/topology.html


Load proj.db, Transform and Display a GeoPackage Geometries in OpenLayers. Be patient - spl.js, OpenLayers and proj.db (~ 6MB) needs to be fetched:

https://jvail.github.io/spl.js/examples/openlayers.html

## API

---

The API for node and browser (returns mostly _thenables_) is identical (almost - file handling is obviously different. See `mount` function).

If you are looking for more examples there are many snippets in the `test/node.js` and `test/browser.js` files.

## SPL

### `SPL`([`extensions`, `options`]) -> `SPL`

extensions: Browser only - see "Extensions API" section below.

options:
- `autoJSON`: If 'true' applies stringify/parse to/from JSON in results and query parameters automatically (default: true)
- `autoGeoJSON`: Automatically converts SpatiaLite/GPKG geometry blobs into GeoJSON if not set to 'false' (default { precision: 6, options: 0 }):
    - `precision`: precision used in Geometry to GeoJSON conversion,
    - `options`: options as described in "AsGeoJSON" in SpatiaLite:
        - 0 no options
        - 1 GeoJSON BoundingBox
        - 2 GeoJSON CRS [short version]
        - 3 BoundingBox + short CRS
        - 4 GeoJSON CRS [long version]
        - 5 BoundingBox + long CRS

### `.db`(`path`: undefined | string | ArrayBuffer) -> `DB`

**Browser**

### `.mount`(`path`: string, options) -> `SPL`

options object properties:

- `buffers`: { `name`: string, `data`: ArrayBuffer }[];
- `files`: { `name`: string, `data`: File | FileList }[];
- `blobs`: { `name`: string, `data`: Blob }[];

Files and Blobs are read only (seems not to work with some SQLite dbs - I'd guess e.g. if WAL mode is enabled).

**Node**

### `.mount`(`path`: string, `mountpoint`: string) -> `SPL`


### `.unmount`(`path`: string) -> `SPL`

### .terminate()

Terminates the WebWorker (only Browser).

## DB

### `.attach`(`db`: string, `schema`: string) -> `DB`
### `.detach`(`schema`: string) -> `DB`
### `.exec`(`sql`: string, [`parameters`: any]) -> `DB`

`parameters` is either an array (or array of arrays) with positional bindings or an object (or array of objects) with named bindings with the following (SQLite) templates:

- ?
- ?NNN
- :VVV
- @VVV
- $VVV

If `autoJSON` is enabled (by default) there is some ambiguity when `parameters` is an array.
Here I can not infer if you want to select 2 rows with values 1 and 2 or a JSON array of [1,2].

```js
db.exec('select json(?)', [1,2]);
```
In such cases it is better to use named parameters for JSON types.
```js
db.exec('select json($js)', { $js: [1,2] });
```

### `.read`(`sql`: string) -> `DB`

Read a SQL script with multiple statements.

### `.load`(`src`: string) -> `DB`

Import a database into the current database. This is using SQLite's backup API.

### `.save`([`dest`: string]) -> `DB` | ArrayBuffer

Export the current database. This is using SQLite's backup API.
If `dest` is undefined or empty an ArrayBuffer is returned.

### `.close`() -> `SPL`

### .get

A result object with the following properties:

### `.first` -> any
### `.flat` -> any[]
### `.rows` -> any[]
### `.cols` -> string[]
### `.objs` -> {}[]
### `.sync` -> synchronous self

## Extensions API (Browser only)

---

Sometimes you want to run code inside the WebWorker. With this API you can supply additional functions to extend the `SPL` and `DB` APIs executed inside the WebWorker.

### Example Code

```js
const extensions = [
    {
        extends: 'db',
        fns: {
            'tables': db => db.exec('select name from sqlite_master where type=\'table\''),
            'master': (db, type) => db.exec('select name from sqlite_master where type=?', [type])
        }
    },
    {
        extends: 'spl',
        fns: {
            'spatialite_version': spl => {
                const db = spl.db();
                const version = db.exec('select spatialite_version()').get.first;
                db.close();
                return version;
            }
        }
    }
];

const spl = await SPL(extensions);
const db = await spl.db()
    .read(`
        create table hello (world);
        create view hello_view as select * from hello;
    `);

console.assert(await db.tables().get.first === 'hello');
console.assert(await db.master('view').get.first === 'hello_view');
console.assert(await spl.spatialite_version() === '5.0.1');
```

## Building and Testing

---

An activated, working emsdk environment is required (https://emscripten.org/docs/tools_reference/emsdk.html). All dependencies except SpatiaLite are fetched from the web. The `src/spatialite` git submodule (https://salsa.debian.org/debian-gis-team/spatialite.git) needs to be initialized before running the build script.

```bash
npm install && npm run build:all
```

Running Node & Browser tests

```bash
npm run test:node && npm run test:firefox && npm run test:chrome
```

Running (the relevant) SpatiaLite test cases - this will take quite some time ... ~ 45 minutes or more.

```bash
npm run test:em
```

## Performance

---

I did not create any fancy benchmark scripts. This is just a rough figure obtained from running a few tests with rttopo:

- In node the performance is ~ 75% of the native SpatiaLite
- In the browser perfomance is ~ 50% (including some overhead from the WebWorker communication)
