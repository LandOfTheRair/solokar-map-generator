
const ROT = require('rot-js');
const fs = require('fs-extra');
const yaml = require('js-yaml');

const spriteData = require('./sprite-data.json');
const config = yaml.load(fs.readFileSync('./config.yml'));

const genWidth = 100;
const genHeight = 100;
const gutter = 5;

Object.keys(config.decor).forEach(decorKey => config.decor[decorKey] = config.decor[decorKey].flat());

Object.keys(config.floors).forEach(floorKey => {
  if(config.floors[floorKey].allowFluids) config.floors[floorKey].fluids = config.floors[floorKey].fluids.flat();

  // don't flatten these, they're picked from intentionally
  // if(config.floors[floorKey].allowTrees) config.floors[floorKey].trees = config.floors[floorKey].trees.flat();

  config.floors[floorKey].decor = config.floors[floorKey].decor.flat(Infinity);
});

config.configs.roomDecor.forEach(({ decors }) => {
  decors.forEach(decorConfig => {
    decorConfig.decor = decorConfig.decor.flat();
  });
});

/*
TODO:

- add spawners (rarely, add monsters that fight with these monsters - ie heniz/steffen, crazed/not)
- add loot 
- add treasure chests
- add random green npcs (trainers, etc; healer trainer must not recall, detect-giving npc for mazes, exit-warping npc, etc)
- config file should support different solokar-style instances with different configs; map prop should specify which config to use (for down/upscaling) (Ruukar for the lil one)
*/

// every possible room type (for digger maze rooms)
const roomDecorConfigs = config.configs.roomDecor;

// each possible theme config
const themes = config.configs.themes;

// each possible dungeon algo config
const configs = config.configs.mapGen;

// each possible fluid config
const fluidConfigs = config.configs.fluidGen;

const addTiledObject = (tiledJSON, layer, obj) => {
  const fullObj = {
    id: tiledJSON.nextobjectid,
    rotation: 0,
    visible: true,
    height: 64,
    width: 64,
    ...obj
  };
  
  tiledJSON.layers[layer].objects.push(fullObj);

  tiledJSON.nextobjectid++;
};

const hasTiledObject = (tiledJSON, layer, x, y) => {
  return tiledJSON.layers[layer].objects.find(obj => obj.x === x * 64 && obj.y === (y + 1) * 64);
}

// fill a map array with wall tiles (to start)
const generateFullMap = () => {
  return Array(genHeight + 10).fill(0).map(y => Array(genWidth + 10).fill(3));
}

// format the map array for raw dumps into .map files
const formatMap = (map) => {
  const charMap = {
    0: ' ',   // empty
    1: '???',   // wall
    2: '+',   // door
    3: '???'    // wall but default
  };

  return map.map(row => row.map(x => charMap[x] || x).join('')).join('\n');
};

const getTileXYFromIndex = (idx, width) => {
  const x = idx % width;
  const y = Math.floor(idx / width);

  return { x, y };
};

const getTileAtXY = (array, width, x, y) => {
  return array[x + (width * y)]
};

const getArrayOfNodesForMapZone = (tiledJSON, startX = 0, endX = 0, startY = 0, endY = 0) => {
  const nodes = [];

  for(let x = startX; x < endX; x++) {
    for(let y = startY; y < endY; y++) {

      const idx = x + (tiledJSON.width * y);
      nodes.push({ 
        x, y,
        idx,
        hasFluid: tiledJSON.layers[2].data[idx] > 0,
        hasFoliage: tiledJSON.layers[3].data[idx] > 0,
        hasWall: tiledJSON.layers[4].data[idx] > 0,
        hasDecor: hasTiledObject(tiledJSON, 5, x, y),
        hasDenseDecor: hasTiledObject(tiledJSON, 6, x, y),
        hasOpaqueDecor: hasTiledObject(tiledJSON, 7, x, y)
      });
    }
  }

  return nodes;
};

// create portal entries from risan to solokar
const addPortalEntries = (tiledJSON, possibleSpaces) => {
  const validSpaces = possibleSpaces.filter(x => !x.hasFluid && !x.hasWall && !x.hasFoliage && !x.hasDecor && !x.hasDenseDecor && !x.hasOpaqueDecor);

  [
    { xStart: 5, xEnd: 40, yStart: 5, yEnd: 40 },   // top left
    { xStart: 60, xEnd: 95, yStart: 5, yEnd: 40 },  // top right
    { xStart: 5, xEnd: 40, yStart: 60, yEnd: 95 },  // bottom left
    { xStart: 60, xEnd: 95, yStart: 60, yEnd: 95 }  // bottom right
  ].forEach(({ xStart, xEnd, yStart, yEnd }, idx) => {

    const validSpacesInZone = validSpaces.filter(x => x.x >= xStart && x.x < xEnd && x.y >= yStart && x.y < yEnd);

    if(validSpacesInZone.length > 0) {
      const portal = ROT.RNG.getItem(validSpacesInZone);
      if(!portal) {
        console.error(new Error('[Solokar] No valid map space for portal entry', { xStart, xEnd, yStart, yEnd }));
        return;
      }

      addTiledObject(tiledJSON, 8, {
        name: 'Tagged Entry',
        type: 'TaggedEntry',
        gid: 1717,
        x: portal.x * 64,
        y: (portal.y + 1) * 64,
        properties: {
          teleportTagRef: 'SolokarLanding-' + (idx + 1)
        }
      });
    }
  });
};

// create exit portals to leave solokar
const addPortalExits = (tiledJSON, possibleSpaces) => {
  const validSpaces = possibleSpaces.filter(tile => {
    if(!tile.hasWall) return;

    const { x, y } = tile;

    const hasW =  getTileAtXY(tiledJSON.layers[4].data, genWidth + (gutter * 2), x - 1, y) !== 0;
    const hasE =  getTileAtXY(tiledJSON.layers[4].data, genWidth + (gutter * 2), x + 1, y) !== 0;
    const hasN =  getTileAtXY(tiledJSON.layers[4].data, genWidth + (gutter * 2), x,     y - 1) !== 0;
    
    const hasNE = getTileAtXY(tiledJSON.layers[4].data, genWidth + (gutter * 2), x + 1, y - 1) !== 0;
    const hasNW = getTileAtXY(tiledJSON.layers[4].data, genWidth + (gutter * 2), x - 1, y - 1) !== 0;

    const noS   = getTileAtXY(tiledJSON.layers[4].data, genWidth + (gutter * 2), x,     y + 1) === 0;

    return hasW && hasE && hasN && hasNE && hasNW && noS;
  });

  [
    { xStart: 5, xEnd: 40, yStart: 5, yEnd: 40 },   // top left
    { xStart: 60, xEnd: 95, yStart: 5, yEnd: 40 },  // top right
    { xStart: 5, xEnd: 40, yStart: 60, yEnd: 95 },  // bottom left
    { xStart: 60, xEnd: 95, yStart: 60, yEnd: 95 }  // bottom right
  ].forEach(({ xStart, xEnd, yStart, yEnd }, idx) => {

    const validSpacesInZone = validSpaces.filter(x => x.x >= xStart && x.x < xEnd && x.y >= yStart && x.y < yEnd);

    if(validSpacesInZone.length > 0) {
      const portal = ROT.RNG.getItem(validSpacesInZone);
      if(!portal) {
        console.error(new Error('[Solokar] No valid map space for portal exit', { xStart, xEnd, yStart, yEnd }));
        return;
      }

      const tileIdx = tiledJSON.layers[4].data[portal.idx];
      tiledJSON.layers[4].data[portal.idx] = 0;

      addTiledObject(tiledJSON, 7, {
        name: 'Tagged Exit Back Wall',
        type: '',
        gid: tileIdx,
        x: portal.x * 64,
        y: (portal.y + 1) * 64
      });

      addTiledObject(tiledJSON, 8, {
        name: 'Tagged Exit',
        type: 'Teleport',
        gid: 1713,
        x: portal.x * 64,
        y: (portal.y + 1) * 64,
        properties: {
          teleportTagMap: 'Frostlands',
          teleportTag: 'SolokarExit-' + (idx + 1)
        }
      });
    }
  });
};

const addStairs = (tiledJSON, possibleSpaces) => {

  const validSpaces = possibleSpaces.filter(x => !x.hasFluid && !x.hasWall && !x.hasFoliage && !x.hasDecor && !x.hasDenseDecor && !x.hasOpaqueDecor);

  const space = ROT.RNG.getItem(validSpaces);
  if(!space || validSpaces.length === 0) {
    console.error(new Error('[Solokar] No valid map space for stairs.'));
    return;
  }

  const { x, y } = space;

  // stairs out = 1777
  const obj = {
    gid: 1777,
    name: 'Tagged Exit Stairs',
    type: 'StairsUp',
    x: x * 64,
    y: (y + 1) * 64,
    properties: {
      teleportTagMap: 'Frostlands',
      teleportTag: 'SolokarExitStairs',
      teleportTagRef: 'SolokarInsideStairs'
    }
  };

  addTiledObject(tiledJSON, 8, obj);

};

const addDoor = (tiledJSON, x, y, themeWall) => {
  
  if(hasTiledObject(tiledJSON, 7, x, y)) return;
  if(hasTiledObject(tiledJSON, 8, x, y)) return;

  const isHorizontalDoor = getTileAtXY(tiledJSON.layers[4].data, tiledJSON.width, x - 1, y) !== 0
                        && getTileAtXY(tiledJSON.layers[4].data, tiledJSON.width, x + 1, y) !== 0;

  const isVerticalDoor   = getTileAtXY(tiledJSON.layers[4].data, tiledJSON.width, x, y - 1) !== 0
                        && getTileAtXY(tiledJSON.layers[4].data, tiledJSON.width, x, y + 1) !== 0;

  // if it doesn't have both sides, it's not door-able
  if(!isHorizontalDoor && !isVerticalDoor) return;

  const isDoor = ROT.RNG.getItem([true, false, false, false]);

  if(isDoor) {
    const firstgid = tiledJSON.tilesets[2].firstgid;
    const tiledId = spriteData.doorStates[themeWall.doorStart + (isHorizontalDoor ? 0 : 1)].tiledId;
  
    const obj = {
      gid: firstgid + tiledId,
      name: "Door",
      type: "Door",
      x: x * 64,
      y: (y + 1) * 64
    };
  
    addTiledObject(tiledJSON, 8, obj);

  } else {
    const firstgid = tiledJSON.tilesets[1].firstgid;
    const tiledId = themeWall.spriteStart + 14 + (isHorizontalDoor ? 1 : 0);
  
    const obj = {
      gid: firstgid + tiledId,
      name: "Secret Wall",
      type: "SecretWall",
      x: x * 64,
      y: (y + 1) * 64
    };
  
    addTiledObject(tiledJSON, 7, obj);
  }
};

const placeFoliage = (tiledJSON, themeFloor) => {
  const treeSets = themeFloor.trees;
  const treeChoices = ROT.RNG.getItem(treeSets);

  tiledJSON.layers[3].data = tiledJSON.layers[3].data.map((d, idx) => {
    if(tiledJSON.layers[4].data[idx] || tiledJSON.layers[2].data[idx]) return 0;
    if(!ROT.RNG.getItem([true, ...Array(9).fill(false)])) return 0;

    return ROT.RNG.getItem(treeChoices) ?? 0;
  });
};

const placeFluids = (tiledJSON, fluidConfig, themeWall, themeFloor) => {

  const firstGid = tiledJSON.tilesets[0].firstgid;
  const fluidSets = themeFloor.fluids;
  const fluidChoice = ROT.RNG.getItem(fluidSets);
  
  // pick a config

  // generate a map
  const mapGenerator = new ROT.Map[fluidConfig.algo](...fluidConfig.algoArgs);

  // some maps require randomize to be set
  if(fluidConfig.randomize) {
    mapGenerator.randomize(fluidConfig.randomize);
  }

  mapGenerator.create((x, y, value) => {
    const pos = x + (y * (genWidth + (gutter * 2)));

    if(fluidConfig.invert && !value) return;
    if(!fluidConfig.invert && value) return;
    if(themeWall.allowEmptyWalls && tiledJSON.layers[4].data[pos]) return;

    tiledJSON.layers[2].data[pos] = firstGid + fluidChoice.spriteStart;
  });

  tiledJSON.layers[2].data = autotileWater(tiledJSON.layers[2].data);
}

// chances = 1/x+1 chance per tile
const placeRandomDecor = (tiledJSON, themeFloor, chances = 9) => {
  for(let i = 0; i < tiledJSON.height * tiledJSON.width; i++) {
    if(tiledJSON.layers[4].data[i] || tiledJSON.layers[3].data[i] || tiledJSON.layers[2].data[i]) continue;
    if(ROT.RNG.getItem([false, ...Array(chances).fill(true)])) continue;

    const { x, y } = getTileXYFromIndex(i, tiledJSON.width);

    if(hasTiledObject(tiledJSON, 5, x, y)) continue;
    if(hasTiledObject(tiledJSON, 6, x, y)) continue;
    if(hasTiledObject(tiledJSON, 7, x, y)) continue;
    if(hasTiledObject(tiledJSON, 8, x, y)) continue;

    const decorSets = themeFloor.decor;
    const decorChoice = ROT.RNG.getItem(decorSets);

    // no gid math because we ripped these numbers directly
    const obj = {
      gid: decorChoice,
      x: x * 64,
      y: (y + 1) * 64
    };
    
    addTiledObject(tiledJSON, 5, obj);
  }
};

const placeRoomDecor = (tiledJSON, themeFloor, room) => {
  if(ROT.RNG.getItem([true, ...Array(9).fill(false)])) return;

  const roomTypeChoice = ROT.RNG.getItem(roomDecorConfigs);
  
  // if custom floors are allowed, swap the tiles
  if(roomTypeChoice.allowCustomFloor) {
    const firstTileGid = tiledJSON.tilesets[0].firstgid;

    const floor = ROT.RNG.getItem(roomTypeChoice.customFloors);

    const push = (floor.flipLR ? 1 : 0);

    // place the base tiles
    for(let x = room.getLeft(); x <= room.getRight() + push; x++) {
      for(let y = room.getTop(); y <= room.getBottom(); y++) {
        const i = (x + gutter) + (tiledJSON.width * (y + gutter));
      
        // handle floor, place default floor
        tiledJSON.layers[0].data[i] = firstTileGid + floor.spriteStart + ROT.RNG.getItem([47, 47, 47, 48]) -1;
      }
    }

    // place the "nice" tiles

    // top row
    for(let x = room.getLeft(); x <= room.getRight() + push; x++) {
      const i = tiledJSON.width * (room.getTop() - 1 + gutter) + x + gutter;
    
      // handle floor, place default floor
      tiledJSON.layers[1].data[i] = firstTileGid + floor.spriteStart + (floor.flipLR ? 16 : 14);
    }

    // bottom row
    for(let x = room.getLeft(); x <= room.getRight() + push; x++) {
      const i = tiledJSON.width * (room.getBottom() + 1 + gutter) + x + gutter;
    
      // handle floor, place default floor
      tiledJSON.layers[1].data[i] = firstTileGid + floor.spriteStart + (floor.flipLR ? 14 : 16);
    }

    // left side
    for(let y = room.getTop(); y <= room.getBottom(); y++) {
      const i = (room.getLeft() - 1 + gutter) + (tiledJSON.width * (y + gutter));
    
      // handle floor, place default floor
      tiledJSON.layers[1].data[i] = firstTileGid + floor.spriteStart + (floor.flipLR ? 15 : 17);
    }

    // right side
    for(let y = room.getTop(); y <= room.getBottom(); y++) {
      const i = (room.getRight() + (floor.flipLR ? 1 : 0) + 1 + gutter) + (tiledJSON.width * (y + gutter));
    
      // handle floor, place default floor
      tiledJSON.layers[1].data[i] = firstTileGid + floor.spriteStart + (floor.flipLR ? 17 : 15);
    }

    // corners

    tiledJSON.layers[1].data[tiledJSON.width * (room.getTop() - 1 + gutter) - 1 + gutter + room.getLeft()] = firstTileGid + floor.spriteStart + (floor.flipLR ? 3 : 30);
    tiledJSON.layers[1].data[tiledJSON.width * (room.getTop() - 1 + gutter) + 1 + gutter + room.getLeft() + (room.getRight() - room.getLeft()) + push] = firstTileGid + floor.spriteStart + (floor.flipLR ? 4 : 31);
    tiledJSON.layers[1].data[tiledJSON.width * (room.getBottom() + 1 + gutter) - 1 + gutter + room.getLeft()] = firstTileGid + floor.spriteStart + (floor.flipLR ? 2 : 33);
    tiledJSON.layers[1].data[tiledJSON.width * (room.getBottom() + 1 + gutter) + 1 + gutter + room.getLeft() + (room.getRight() - room.getLeft()) + push] = firstTileGid + floor.spriteStart + (floor.flipLR ? 1 : 32);
  }

  const coords = [];

  for(let x = room.getLeft(); x <= room.getRight(); x++) {
    for(let y = room.getTop(); y <= room.getBottom(); y++) {
      const i = (x + gutter) + (tiledJSON.width * (y + gutter));
      if(tiledJSON.layers[4].data[i] || tiledJSON.layers[3].data[i] || tiledJSON.layers[2].data[i]) continue;

      coords.push({ x: x + gutter, y: y + gutter });
    }
  }
  
  roomTypeChoice.decors.forEach(({ quantity, decor }) => {
    const realQty = ROT.RNG.getItem(quantity);

    for(let i = 0; i < realQty; i++) {
      if(coords.length === 0) break;

      const randomIdx = ROT.RNG.getUniform() * coords.length;
      const coordObj = coords.splice(randomIdx, 1)[0];

      const { x, y } = coordObj;

      // no gid math because we ripped these numbers directly
      const obj = {
        gid: ROT.RNG.getItem(decor),
        name: "",
        type: "",
        x: x * 64,
        y: (y + 1) * 64
      };
    
      addTiledObject(tiledJSON, 5, obj);

    }
  });

};

const autotileWater = (waterArray, width = 110, height = 110) => {
  return waterArray.map((value, idx) => {
    if(value === 0) return 0;

    const { x, y } = getTileXYFromIndex(idx, width);

    const fluidNW = getTileAtXY(waterArray, width, x - 1,  y - 1)  !== 0;
    const fluidN  = getTileAtXY(waterArray, width, x,      y - 1)  !== 0;
    const fluidNE = getTileAtXY(waterArray, width, x + 1,  y - 1)  !== 0;
    const fluidE =  getTileAtXY(waterArray, width, x + 1,  y)      !== 0;
    const fluidSE = getTileAtXY(waterArray, width, x + 1,  y + 1)  !== 0;
    const fluidS  = getTileAtXY(waterArray, width, x,      y + 1)  !== 0;
    const fluidSW = getTileAtXY(waterArray, width, x - 1,  y + 1)  !== 0;
    const fluidW  = getTileAtXY(waterArray, width, x - 1,  y)      !== 0;

    if (!fluidNW && fluidN && fluidNE && fluidE && fluidSE && fluidS && fluidSW && fluidW) return value + 1; // NW corner missing
    if (fluidNW && fluidN && !fluidNE && fluidE && fluidSE && fluidS && fluidSW && fluidW) return value + 2; // NE corner missing
    if (fluidNW && fluidN && fluidNE && fluidE && !fluidSE && fluidS && fluidSW && fluidW) return value + 3; // SE corner missing
    if (fluidNW && fluidN && fluidNE && fluidE && fluidSE && fluidS && !fluidSW && fluidW) return value + 4; // SW corner missing

    if (!fluidNW && fluidN && !fluidNE && fluidE && fluidSE && fluidS && fluidSW && fluidW) return value + 5;  // NE,NW corner missing
    if (fluidNW && fluidN && !fluidNE && fluidE && !fluidSE && fluidS && fluidSW && fluidW) return value + 6;  // NE,SE corner missing
    if (fluidNW && fluidN && fluidNE && fluidE && !fluidSE && fluidS && !fluidSW && fluidW) return value + 7;  // SE,SW corner missing
    if (!fluidNW && fluidN && fluidNE && fluidE && fluidSE && fluidS && !fluidSW && fluidW) return value + 8;  // SW,NW corner missing

    if (!fluidNW && fluidN && !fluidNE && fluidE && fluidSE && fluidS && !fluidSW && fluidW) return value + 9; // NW,NE,SW corner missing
    if (!fluidNW && fluidN && !fluidNE && fluidE && !fluidSE && fluidS && fluidSW && fluidW) return value + 10; // NW,NE,SE corner missing
    if (fluidNW && fluidN && !fluidNE && fluidE && !fluidSE && fluidS && !fluidSW && fluidW) return value + 11; // NE,SE,SW corner missing
    if (!fluidNW && fluidN && fluidNE && fluidE && !fluidSE && fluidS && !fluidSW && fluidW) return value + 12; // NW,SE,SW corner missing

    if (!fluidNW && fluidN && !fluidNE && fluidE && !fluidSE && fluidS && !fluidSW && fluidW) return value + 13;  // ALL corner missing

    if (!fluidN && fluidE && fluidSE && fluidS && fluidSW && fluidW) return value + 14; // N missing NE,NW unchecked
    if (fluidNW && fluidN && !fluidE && fluidS && fluidSW && fluidW) return value + 15; // E missing NE,SE unchecked
    if (fluidNW && fluidN && fluidNE && fluidE && !fluidS && fluidW) return value + 16; // S missing SE,SW unchecked
    if (fluidN && fluidNE && fluidE && fluidSE && fluidS && !fluidW) return value + 17; // W missing SW,NW unchecked

    if (!fluidNW && fluidN && fluidNE && fluidE && !fluidS && fluidW) return value + 18;  // NW,S missing SE,SW unchecked
    if (fluidNW && fluidN && !fluidNE && fluidE && !fluidS && fluidW) return value + 19;  // NE,S missing SE,SW unchecked
    if (!fluidN && fluidE && !fluidSE && fluidS && fluidSW && fluidW) return value + 20;  // SE,N missing NE,NW unchecked
    if (!fluidN && fluidE && fluidSE && fluidS && !fluidSW && fluidW) return value + 21;  // SW,N missing NE,NW unchecked

    if (!fluidNW && fluidN && !fluidE && fluidS && fluidSW && fluidW) return value + 22;  // NW,E missing NE,SE unchecked
    if (fluidN && !fluidNE && fluidE && fluidSE && fluidS && !fluidW) return value + 23;  // NE,W missing NW,SW unchecked
    if (fluidN && fluidNE && fluidE && !fluidSE && fluidS && !fluidW) return value + 24;  // SE,W missing NW,SW unchecked
    if (fluidNW && fluidN && !fluidE && fluidS && !fluidSW && fluidW) return value + 25;  // SW,E missing NE,SE unchecked

    if (!fluidN && fluidE && !fluidSE && fluidS && !fluidSW && fluidW) return value + 26; // SE,SW,N missing NW,NE unchecked
    if (!fluidNW && fluidN && !fluidE && fluidS && !fluidSW && fluidW) return value + 27; // NW,SW,E missing SE,NE unchecked
    if (!fluidNW && fluidN && !fluidNE && fluidE && !fluidS && fluidW) return value + 28; // NE,NW,S missing SE,SW unchecked
    if (fluidN && !fluidNE && fluidE && !fluidSE && fluidS && !fluidW) return value + 29; // NE,SE,W missing NW,SW unchecked

    if (!fluidN && fluidE && fluidSE && fluidS && !fluidW) return value + 30; // E,SE,S present, NE,SW,NW unchecked
    if (!fluidN && !fluidE && fluidS && fluidSW && fluidW) return value + 31; // W,SW,S present, NW,SE,NE unchecked
    if (fluidNW && fluidN && !fluidE && !fluidS && fluidW) return value + 32; // W,NW,N present, NE,SE,SW unchecked
    if (fluidN && fluidNE && fluidE && !fluidS && !fluidW) return value + 33; // E,NE,N present, NW,SE,SW unchecked

    if (!fluidN && fluidE && fluidS && !fluidW) return value + 34;  // E,S present, CORNERS unchecked
    if (!fluidN && !fluidE && fluidS && fluidW) return value + 35;  // W,S present, CORNERS unchecked
    if (fluidN && !fluidE && !fluidS && fluidW) return value + 36;  // W,N present, CORNERS unchecked
    if (fluidN && fluidE && !fluidS && !fluidW) return value + 37;  // E,N present, CORNERS unchecked

    if (!fluidN && !fluidE && fluidS && !fluidW) return value + 38; // S present, CORNERS unchecked
    if (!fluidN && !fluidE && !fluidS && fluidW) return value + 39; // W present, CORNERS unchecked
    if (fluidN && !fluidE && !fluidS && !fluidW) return value + 40; // N present, CORNERS unchecked
    if (!fluidN && fluidE && !fluidS && !fluidW) return value + 41; // E present, CORNERS unchecked

    if (fluidN && !fluidE && fluidS && !fluidW) return value + 42;  // N,S present, CORNERS unchecked
    if (!fluidN && fluidE && !fluidS && fluidW) return value + 43;  // E,W present, CORNERS unchecked

    if (!fluidNW && fluidN && fluidNE && fluidE && !fluidSE && fluidS && fluidSW && fluidW) return value + 44;  // NW,SE missing
    if (fluidNW && fluidN && !fluidNE && fluidE && fluidSE && fluidS && !fluidSW && fluidW) return value + 46;  // NE,SW missing

    if (fluidNW && fluidN && fluidNE && fluidE && fluidSE && fluidS && fluidSW && fluidW) return value + 47;  // ALL present

    return value;
  });
};

const autotileWalls = (wallsArray, doorsArray, width = 110, height = 110, allowEmptyWalls = false) => {
  return wallsArray.map((wall, idx) => {
    if(wall === 0) return 0;

    const { x, y } = getTileXYFromIndex(idx, width);

    const hasTopTile =    getTileAtXY(wallsArray, width, x, y - 1) !== 0;
    const hasBottomTile = getTileAtXY(wallsArray, width, x, y + 1) !== 0;
    const hasLeftTile =   getTileAtXY(wallsArray, width, x - 1, y) !== 0;
    const hasRightTile =  getTileAtXY(wallsArray, width, x + 1, y) !== 0;

    const hasLeftDoor = getTileAtXY(doorsArray, width, x - 1, y) !== 0 
                     && getTileAtXY(wallsArray, width, x - 2, y) !== 0
                     && getTileAtXY(wallsArray, width, x, y) !== 0;

    const hasRightDoor = getTileAtXY(doorsArray, width, x + 1, y) !== 0 
                      && getTileAtXY(wallsArray, width, x + 2, y) !== 0
                      && getTileAtXY(wallsArray, width, x, y) !== 0;

    const hasTopDoor = getTileAtXY(doorsArray, width, x, y - 1) !== 0 
                    && getTileAtXY(wallsArray, width, x, y - 2) !== 0
                    && getTileAtXY(wallsArray, width, x, y) !== 0;

    const hasBottomDoor = getTileAtXY(doorsArray, width, x, y + 1) !== 0 
                       && getTileAtXY(wallsArray, width, x, y + 2) !== 0
                       && getTileAtXY(wallsArray, width, x, y) !== 0

    const hasTop = hasTopTile || hasTopDoor;
    const hasBottom = hasBottomTile || hasBottomDoor;
    const hasLeft = hasLeftTile || hasLeftDoor;
    const hasRight = hasRightTile || hasRightDoor;

    // "auto tiling" lol fuck you I'm doing this manually
    if(!hasTop && !hasBottom && !hasLeft && !hasRight)  return allowEmptyWalls ? wall : 0;
    if(hasTop && hasBottom && hasLeft && hasRight)      return wall + 1;
    if(!hasTop && hasBottom && hasLeft && hasRight)     return wall + 2;
    if(hasTop && hasBottom && hasLeft && !hasRight)     return wall + 3;

    if(hasTop && !hasBottom && hasLeft && hasRight)     return wall + 4;
    if(hasTop && hasBottom && !hasLeft && hasRight)     return wall + 5;
    if(!hasTop && hasBottom && !hasLeft && hasRight)    return wall + 6;
    if(!hasTop && hasBottom && hasLeft && !hasRight)    return wall + 7;

    if(hasTop && !hasBottom && hasLeft && !hasRight)    return wall + 8;
    if(hasTop && !hasBottom && !hasLeft && hasRight)    return wall + 9;
    if(!hasTop && hasBottom && !hasLeft && !hasRight)   return wall + 10;
    if(!hasTop && !hasBottom && hasLeft && !hasRight)   return wall + 11;

    if(hasTop && !hasBottom && !hasLeft && !hasRight)   return wall + 12;
    if(!hasTop && !hasBottom && !hasLeft && hasRight)   return wall + 13;
    if(hasTop && hasBottom && !hasLeft && !hasRight)    return wall + 14;
    if(!hasTop && !hasBottom && hasLeft && hasRight)    return wall + 15;

    return wall;
  });
};

const mapArrayFiltered = (mapData, filters = []) => {
  const res = [];

  mapData.forEach(arr => {
    const filtered = arr.map(x => filters.includes(x) ? 1 : 0);
    res.push(...filtered);
  });

  return res;
};

const writeMap = (name, config, mapData, rooms, theme) => {
  const tiledJSON = fs.readJSONSync('./RNGTemplate100.json');

  /*
  tile layers:
  - terrain: 0
  - floors: 1
  - fluids: 2,
  - foliage: 3
  - walls: 4

  object layers:
  - decor: 5
  - opaquedecor: 7
  - interactables: 8
  - spawners: 10
  */

  // rip out tile data
  const firstTileGid = tiledJSON.tilesets[0].firstgid;
  const firstWallGid = tiledJSON.tilesets[1].firstgid;

  // handle floor, place default floor
  tiledJSON.layers[0].data = tiledJSON.layers[0].data.map(() => firstTileGid + theme.floor.spriteStart + ROT.RNG.getItem([47, 47, 47, 48]) - 1);

  // handle walls, auto tile
  const allWalls = mapArrayFiltered(mapData, [1, 3]);
  const doors = mapArrayFiltered(mapData, [2]);

  const walls = allWalls.map((val) => val === 0 ? 0 : firstWallGid + theme.wall.spriteStart);
  tiledJSON.layers[4].data = autotileWalls(walls, doors, tiledJSON.width, tiledJSON.height, theme.wall.allowEmptyWalls);

  // check if we can add fluids, and fail only 1/5 of the time
  if(theme.floor.allowFluids && ROT.RNG.getItem([true, ...Array(4).fill(false)])) {
    const fluidConfig = ROT.RNG.getItem(fluidConfigs);
    console.log('Fluid Config', fluidConfig.name);

    let attempts = 0;
    while(tiledJSON.layers[2].data.filter(Boolean).length === 0 && attempts++ < 10) {
      placeFluids(tiledJSON, fluidConfig, theme.wall, theme.floor);
    }

    if(attempts >= 10) {
      console.log('Failed to place fluids. 10 times. Wow?');
    }
  }

  // if we allow trees, get them in there. no fail because thieves.
  if(theme.floor.allowTrees) {
    placeFoliage(tiledJSON, theme.floor);
  }

  // handle doors
  if(config.doors && theme.wall.allowDoors) {
    rooms.forEach(room => {
      room.getDoors((x, y) => {
        addDoor(tiledJSON, x + gutter, y + gutter, theme.wall);
      });

      placeRoomDecor(tiledJSON, theme.floor, room);
    });
    
    placeRandomDecor(tiledJSON, theme.floor, 99);

  } else {
    placeRandomDecor(tiledJSON, theme.floor, 19);
  }

  
  const possibleSpacesForPlacements = getArrayOfNodesForMapZone(tiledJSON, gutter, genWidth - gutter, gutter, genHeight - gutter);

  addPortalEntries(tiledJSON, possibleSpacesForPlacements.slice());
  addPortalExits(tiledJSON, possibleSpacesForPlacements.slice());
  addStairs(tiledJSON, possibleSpacesForPlacements.slice());

  // door debug code
  /*
  spriteData.doorStates.forEach((door, idx) => {
    addDoor(tiledJSON, idx, 5, idx)
  });
  */

  const obj = {
    gid: 0,
    height: 64 * 110,
    visible: false,
    width: 64 * 110,
    x: 0,
    y: 0
  };

  addTiledObject(tiledJSON, 13, obj);

  ['gearDrop', 'kick', 'respawn'].forEach(key => {
    tiledJSON.properties[key + 'Map'] = 'Frostlands';
    tiledJSON.properties[key + 'X'] = 174;
    tiledJSON.properties[key + 'Y'] = 224;
  });

  tiledJSON.properties.respawnKick = true;
  tiledJSON.properties.blockEntryMessage = 'The maze is currently shifting... try back later!';

  // fs.writeFileSync(`./${name}.map`, formatMap(mapData));
  fs.writeJSONSync(`./${name}.json`, tiledJSON);
};

const generateMap = (seed) => {

  if(!seed) {
    // year + month + day of month, should always be unique
    seed = new Date().getFullYear() + '-' + new Date().getMonth() + '-' + new Date().getDate();
  }

  const finalMap = generateFullMap();

  // const rng = ROT.RNG.clone();

  // pick a seed
  ROT.RNG.setSeed(seed);

  // we have to do this because the RNG never gives you anything but first for the next call lol
  const randomConfigOrdering = ROT.RNG.shuffle(configs);

  // pick a config
  const config = ROT.RNG.getItem(randomConfigOrdering);

  // pick a theme
  const theme = ROT.RNG.getItem(Object.keys(themes));
  const themeData = themes[theme];

  // generate a map
  const mapName = `map-${seed}-${config.name}`;
  const mapGenerator = new ROT.Map[config.algo](...config.algoArgs);
  console.log('MapGen Config', { mapName, config: config.name, theme });

  // some maps require randomize to be set
  if(config.randomize) {
    mapGenerator.randomize(config.randomize);
  }

  // update a node, but offset+5 because of the gutter for the map
  const updateNode = (x, y, value) => {
    finalMap[y + gutter][x + gutter] = value;
  };

  // do iterations based on number of iterations (mostly for cellular automata)
  for(let i = 0; i < config.iterations; i++) {
    mapGenerator.create(i === config.iterations - 1 ? updateNode : null);
  }

  // add doors if the algo demands it (some mazes)
  let rooms = [];
  if(config.doors && themeData.wall.allowDoors) {
    rooms = mapGenerator.getRooms();
    rooms.forEach(room => {
      room.getDoors((x, y) => updateNode(x, y, 2));
    });
  }

  // add connections if the algo demands it (automata)
  if(config.connect) {
    mapGenerator.connect(updateNode);
  }

  writeMap(mapName, config, finalMap, rooms, themeData);
};

for(let i = 0; i < 10; i++) {
  generateMap(i);
}