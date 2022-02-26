
const ROT = require('rot-js');
const fs = require('fs-extra');

const spriteData = require('./sprite-data.json');

const genWidth = 100;
const genHeight = 100;

/*
TODO:
- add fluids (floor flag; create a small digger map and overlay it on top)
- add foliage (floor flag; each tile has a {treeSpawn} chance of spawning a tree, spawn randomly on walls and as foliage)
- add decor randomly (fill spaces randomly with decor; need a decor list per theme)
- add decor to rooms (fill rooms with decor - need a decor list per theme)
- add floors
- add spawners
- add loot
- add random green npcs
- add portal entries (one per quadrant)
- add portal exits (one per quadrant)
- add succorport to prevent everything
*/

const foliage = {
  apple:          [1998, 1999, 2000, 2001, 2002, 2003],
  fall:           [2004, 2005, 2006, 2007, 2012, 2013, 2014, 2015, 2016, 2017, 2018],
  dead:           [2133, 2134, 2135, 2136, 2137, 2138, 2139, 2140, 2172, 2173, 2174, 2175, 2177, 2178, 2179, 2180, 2146, 2147, 2148, 2149, 2150, 2151, 2152, 2153, 2159, 2160, 2161, 2162, 2163, 2164, 2166, 2167],
  evergreen:      [2169, 2170, 2171, 2141, 2142, 2144, 2145, 2181, 2182, 2183, 2184, 2155, 2156, 2157, 2158, 2168]
};

const decor = {
  furrug:         [1701, 1702, 1703, 1704, 1705, 1706, 1707, 1708, 1709, 1710, 1711, 1712],
  bed:            [1729, 1730, 1731, 1732, 1733, 1734, 1735, 1736, 1737, 1738, 1739, 1740, 1725, 1726, 1727, 1728, 1517, 1518, 1519, 1520],
  pillar:         [2259, 2260, 2261, 2210],
  grave:          [1761, 1762, 1763, 1764, 1765, 1766, 1767, 1768, 1769, 1770, 1771, 1772, 1773, 1774, 1775, 1776, 1796, 1797, 1798, 1799, 1800, 1801],
  fountain:       [2226, 2227, 2228, 2229],
  barrel:         [2374, 2375, 2206],
  misc:           [1613, 1614, 1615, 1616, 2211, 2212, 2213, 2214, 2215, 2209, 2223, 2224, 2105, 1840, 1841, 1842, 1843, 1844, 1845, 1846, 1847, 1848, 2207, 2208, 2203, 1838, 1839, 1849, 1850, 1851, 1852, 1853, 1854, 1855],
  furniture:      [1581, 1582, 1583, 1584, 1585, 1586, 1587, 1588, 1589, 1590, 1591, 1592, 1593, 1594, 1595, 1596, 1597, 1598, 1599, 1600],
  water:          [2275, 2276, 2277, 2278, 2279, 2280],
  oil:            [2281, 2282, 2283, 2284, 2285, 2286],
  blood:          [2287, 2288, 2289, 2290, 2291],
  directional:    [1501, 1502, 1503, 1504, 1505, 1506, 1507, 1508, 1509, 1510, 1511, 1512, 1513, 1514, 1515, 1516, 1521, 1522, 1523, 1524, 1529, 1530, 1531, 1532, 1533, 1534, 1535, 1536, 1537, 1538, 1539, 1540, 1541, 1542, 1543, 1544, 1601, 1602, 1603, 1604]
};

// each possible theme floor
const floors = {
  darktile:       { spriteStart: 0    },
  sand:           { spriteStart: 48   },
  nicetile:       { spriteStart: 96   },
  wood:           { spriteStart: 144  },
  mist:           { spriteStart: 288  },
  grassair:       { spriteStart: 576, allowTrees: true, trees: [foliage.apple, foliage.fall, foliage.dead, foliage.evergreen] },
  cobblestone:    { spriteStart: 672  },
  snow:           { spriteStart: 720, allowTrees: true, trees: [foliage.dead, foliage.evergreen]  },
  flowergrass:    { spriteStart: 816, allowTrees: true, trees: [foliage.apple]  },
  deepgrass:      { spriteStart: 864, },
  swamp:          { spriteStart: 912, allowTrees: true, trees: [foliage.dead, foliage.evergreen]  },
};

// each possible theme wall
const walls = {
  ether:          { spriteStart: 0,   allowDoors: true, doorStart: 8,   allowHiddenWalls: true },
  undead:         { spriteStart: 16,  allowDoors: true, doorStart: 10,  allowHiddenWalls: true },
  cave:           { spriteStart: 48,  allowDoors: true, doorStart: 12,  allowHiddenWalls: true,  allowEmptyWalls: true },
  stone:          { spriteStart: 64,  allowDoors: true, doorStart: 14,  allowHiddenWalls: true },
  goldstone:      { spriteStart: 80,  allowDoors: true, doorStart: 16 },
  town:           { spriteStart: 96,  allowDoors: true, doorStart: 18,  allowHiddenWalls: true },
  nicetown:       { spriteStart: 160, allowDoors: true, doorStart: 24,  allowHiddenWalls: true },
  nicetownwhite:  { spriteStart: 176, allowDoors: true, doorStart: 26 },
  nicestone:      { spriteStart: 192, allowDoors: true, doorStart: 28 },
  tent:           { spriteStart: 208, allowDoors: true, doorStart: 6  },
  vibrant:        { spriteStart: 224, allowEmptyWalls: true },
  icestone:       { spriteStart: 272, allowEmptyWalls: true },
  tree:           { spriteStart: 288, allowEmptyWalls: true },
  library:        { spriteStart: 320 },
  goldcave:       { spriteStart: 336, allowDoors: true, doorStart: 30,  allowHiddenWalls: true },
};

const fluids = {
  water:          { spriteStart: 384 },
  darkwater:      { spriteStart: 768 },
  lava:           { spriteStart: 432 },
};

// each possible theme config
const themes = {
  basictown:        { floor: floors.wood,         wall: walls.town,            },
  basictown2:       { floor: floors.wood,         wall: walls.nicetown,        },
  basictown3:       { floor: floors.wood,         wall: walls.nicetownwhite,   },
  
  cobbletown:       { floor: floors.cobblestone,  wall: walls.town,            },
  cobbletown2:      { floor: floors.cobblestone,  wall: walls.nicetown,        },
  cobbletown3:      { floor: floors.cobblestone,  wall: walls.nicetownwhite,   },
  
  darkcobbletown:   { floor: floors.darktile,     wall: walls.town,            },
  darkcobbletown2:  { floor: floors.darktile,     wall: walls.nicetown,        },
  darkcobbletown3:  { floor: floors.darktile,     wall: walls.nicetownwhite,   },

  dungeon:          { floor: floors.nicetile,     wall: walls.stone,           }, 
  dungeon2:         { floor: floors.nicetile,     wall: walls.goldstone,       },
  dungeon3:         { floor: floors.nicetile,     wall: walls.icestone },
  dungeon4:         { floor: floors.darktile,     wall: walls.stone,           },
  dungeon5:         { floor: floors.darktile,     wall: walls.goldstone,       },
  dungeon6:         { floor: floors.darktile,     wall: walls.icestone         },
  dungeon7:         { floor: floors.cobblestone,  wall: walls.stone,           },
  dungeon8:         { floor: floors.cobblestone,  wall: walls.goldstone,       },
  dungeon9:         { floor: floors.cobblestone,  wall: walls.icestone         },
  dungeon10:        { floor: floors.nicetile,     wall: walls.ether,           },
  dungeon11:        { floor: floors.nicetile,     wall: walls.goldcave,        },
  
  undeadtown:       { floor: floors.darktile,     wall: walls.undead,          },
  undeadtown2:      { floor: floors.nicetile,     wall: walls.undead,          },
  
  desert:           { floor: floors.sand,         wall: walls.undead,          },
  deserttree:       { floor: floors.sand,         wall: walls.tree,            },
  deserttown:       { floor: floors.sand,         wall: walls.stone,           },
  deserttown2:      { floor: floors.sand,         wall: walls.nicestone,       },
  deserttent:       { floor: floors.sand,         wall: walls.tent,            },

  forest:           { floor: floors.grassair,     wall: walls.tree,            },
  forest2:          { floor: floors.grassair,     wall: walls.cave,            },
  forest3:          { floor: floors.grassair,     wall: walls.stone,           },
  forest4:          { floor: floors.swamp,        wall: walls.tree,            },
  forest5:          { floor: floors.swamp,        wall: walls.cave,            },
  forest6:          { floor: floors.swamp,        wall: walls.stone,           },
  forest7:          { floor: floors.flowergrass,  wall: walls.tree,            },
  forest8:          { floor: floors.flowergrass,  wall: walls.cave,            },
  forest9:          { floor: floors.flowergrass,  wall: walls.stone,           },
  forest10:         { floor: floors.deepgrass,    wall: walls.tree,            },
  forest11:         { floor: floors.deepgrass,    wall: walls.cave,            },
  forest12:         { floor: floors.deepgrass,    wall: walls.stone,           },

  mountain:         { floor: floors.snow,         wall: walls.tree,            },
  mountain2:        { floor: floors.snow,         wall: walls.cave,            },
  mountain3:        { floor: floors.snow,         wall: walls.stone,           },
  mountain4:        { floor: floors.snow,         wall: walls.icestone         },

  library:          { floor: floors.wood,         wall: walls.library          },

  vibrant:          { floor: floors.nicetile,     wall: walls.vibrant,         },
  vibrant2:         { floor: floors.mist,         wall: walls.vibrant,         },
};

// each possible dungeon algo config
const configs = [
  {
    name: 'Digger Maze',
    algo: 'Digger',
    algoArgs: [genWidth, genHeight, { roomWidth: [5, 10], roomHeight: [5, 10], corridorLength: [3, 10], dugPercentage: 0.35 }],
    iterations: 1,
    doors: true
  },
  {
    name: 'Digger Maze, More Rooms',
    algo: 'Digger',
    algoArgs: [genWidth, genHeight, { roomWidth: [3, 7], roomHeight: [3, 7], corridorLength: [6, 15], dugPercentage: 0.5 }],
    iterations: 1,
    doors: true
  },
  {
    name: 'Uniform Maze',
    algo: 'Uniform',
    algoArgs: [genWidth, genHeight, { roomWidth: [4, 7], roomHeight: [4, 7], roomDugPercentage: 0.7 }],
    iterations: 1,
    doors: true
  },
  {
    name: 'Cavelike, Open',
    algo: 'Cellular',
    algoArgs: [genWidth, genHeight, { connected: true }],
    randomize: 0.4,
    iterations: 1,
    connect: true
  },
  {
    name: 'Cavelike, Organic Dug-In',
    algo: 'Cellular',
    algoArgs: [genWidth, genHeight, { connected: true }],
    randomize: 0.6,
    iterations: 1,
    connect: true
  },
  {
    name: 'Cavelike, Cavernous',
    algo: 'Cellular',
    algoArgs: [genWidth, genHeight, { connected: true, born: [4, 5, 6, 7, 8], survive: [2, 3, 4, 5] }],
    randomize: 0.7,
    iterations: 1,
    connect: true
  },
  {
    name: 'Cavelike, Cavernous, Open',
    algo: 'Cellular',
    algoArgs: [genWidth, genHeight, { connected: true, born: [4, 5, 6, 7, 8], survive: [2, 3, 4, 5] }],
    randomize: 0.8,
    iterations: 1,
    connect: true
  },
  {
    name: 'Cavelike, Cavernous, Wide Open',
    algo: 'Cellular',
    algoArgs: [genWidth, genHeight, { connected: true, born: [2, 4, 6, 8], survive: [2, 4, 6] }],
    randomize: 0.9,
    iterations: 3,
    connect: true
  },
  {
    name: 'Cavelike, Cavernous, Super Wide Open',
    algo: 'Cellular',
    algoArgs: [genWidth, genHeight, { connected: true, born: [4, 5, 6, 7, 8], survive: [1, 2, 3, 4, 5] }],
    randomize: 0.9,
    iterations: 50,
    connect: true
  }
];

// fill a map array with wall tiles (to start)
const generateFullMap = () => {
  return Array(genHeight + 10).fill(0).map(y => Array(genWidth + 10).fill(3));
}

// format the map array for raw dumps into .map files
const formatMap = (map) => {
  const charMap = {
    0: ' ',   // empty
    1: '█',   // wall
    2: '+',   // door
    3: '█'    // wall but default
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
}

const addDoor = (tiledJSON, x, y, themeWall) => {

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
      height: 64,
      id: tiledJSON.nextobjectid,
      name: "",
      rotation: 0,
      type: "Door",
      visible: true,
      width: 64,
      x: x * 64,
      y: (y + 1) * 64
    };
  
    tiledJSON.layers[8].objects.push(obj);

  } else {
    const firstgid = tiledJSON.tilesets[1].firstgid;
    const tiledId = themeWall.spriteStart + 14 + (isHorizontalDoor ? 1 : 0);
  
    const obj = {
      gid: firstgid + tiledId,
      height: 64,
      id: tiledJSON.nextobjectid,
      name: "",
      rotation: 0,
      type: "SecretWall",
      visible: true,
      width: 64,
      x: x * 64,
      y: (y + 1) * 64
    };
  
    tiledJSON.layers[7].objects.push(obj);
  }

  tiledJSON.nextobjectid++;
};

const placeRandomDecor = (tiledJSON) => {
  // TODO:
};

const placeRoomDecor = (tiledJSON, room) => {
  // TODO:
  // room.getLeft() getRight() getTop() getBottom() getCenter() [x,y]
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
    if(!hasTop && !hasBottom && !hasLeft && !hasRight) return allowEmptyWalls ? wall : 0;
    if(hasTop && hasBottom && hasLeft && hasRight) return wall + 1;
    if(!hasTop && hasBottom && hasLeft && hasRight) return wall + 2;
    if(hasTop && hasBottom && hasLeft && !hasRight) return wall + 3;

    if(hasTop && !hasBottom && hasLeft && hasRight) return wall + 4;
    if(hasTop && hasBottom && !hasLeft && hasRight) return wall + 5;
    if(!hasTop && hasBottom && !hasLeft && hasRight) return wall + 6;
    if(!hasTop && hasBottom && hasLeft && !hasRight) return wall + 7;

    if(hasTop && !hasBottom && hasLeft && !hasRight) return wall + 8;
    if(hasTop && !hasBottom && !hasLeft && hasRight) return wall + 9;
    if(!hasTop && hasBottom && !hasLeft && !hasRight) return wall + 10;
    if(!hasTop && !hasBottom && hasLeft && !hasRight) return wall + 11;

    if(hasTop && !hasBottom && !hasLeft && !hasRight) return wall + 12;
    if(!hasTop && !hasBottom && !hasLeft && hasRight) return wall + 13;
    if(hasTop && hasBottom && !hasLeft && !hasRight) return wall + 14;
    if(!hasTop && !hasBottom && hasLeft && hasRight) return wall + 15;

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

  // handle doors
  if(config.doors && theme.wall.allowDoors) {
    rooms.forEach(room => {
      room.getDoors((x, y) => {
        addDoor(tiledJSON, x + 5, y + 5, theme.wall);
      });

      placeRoomDecor(tiledJSON, room);
    });

  } else {
    placeRandomDecor(tiledJSON);
  }

  // door debug code
  /*
  spriteData.doorStates.forEach((door, idx) => {
    addDoor(tiledJSON, idx, 5, idx)
  });
  */

  // fs.writeFileSync(`./${name}.map`, formatMap(mapData));
  fs.writeJSONSync(`./${name}.json`, tiledJSON);
};

const generateMap = (seed) => {

  if(!seed) {
    // year + month + day of month, should always be unique
    seed = new Date().getFullYear() + '-' + new Date().getMonth() + '-' + new Date().getDate()
  }

  const finalMap = generateFullMap();

  // pick a seed
  ROT.RNG.setSeed(seed);

  // we have to do this because the RNG never gives you anything but first for the next call lol
  const randomConfigOrdering = ROT.RNG.shuffle(configs);

  // pick a config
  const config = ROT.RNG.getItem(randomConfigOrdering.filter(x => x.algo === 'Digger'));

  // pick a theme
  const theme = ROT.RNG.getItem(Object.keys(themes));
  const themeData = themes[theme];

  // generate a map
  const mapGenerator = new ROT.Map[config.algo](...config.algoArgs);
  console.log('MapGen Config', { config: config.name, theme });

  // some maps require randomize to be set
  if(config.randomize) {
    mapGenerator.randomize(config.randomize);
  }

  // update a node, but offset+5 because of the gutter for the map
  const updateNode = (x, y, value) => {
    finalMap[y + 5][x + 5] = value;
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

  writeMap(`map-${seed}-${config.name}`, config, finalMap, rooms, themeData);
};

for(let i = 0; i < 10; i++) {
  generateMap(i);
}