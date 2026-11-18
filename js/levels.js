import { caveLevel } from "./cave-level.js";

const ground = (width) => ({ x: 0, y: 474, w: width, h: 100, type: "ground" });

const meadow = {
  name: "אחו של בוקר",
  width: 3100,
  platforms: [
    ground(760), { x: 850, y: 474, w: 630, h: 100, type: "ground" },
    { x: 1570, y: 474, w: 680, h: 100, type: "ground" }, { x: 2340, y: 474, w: 760, h: 100, type: "ground" },
    { x: 300, y: 390, w: 145, h: 24, type: "grass" }, { x: 515, y: 325, w: 130, h: 24, type: "brick" },
    { x: 925, y: 387, w: 150, h: 24, type: "grass" }, { x: 1160, y: 325, w: 120, h: 24, type: "brick" },
    { x: 1370, y: 392, w: 95, h: 24, type: "grass" }, { x: 1710, y: 365, w: 165, h: 24, type: "brick" },
    { x: 1950, y: 305, w: 130, h: 24, type: "grass" }, { x: 2160, y: 380, w: 120, h: 24, type: "brick" },
    { x: 2470, y: 378, w: 140, h: 24, type: "grass" }, { x: 2715, y: 320, w: 120, h: 24, type: "brick" },
  ],
  coins: [[345,350],[390,350],[555,285],[610,285],[962,345],[1010,345],[1195,285],[1410,350],[1755,325],[1800,325],[1990,265],[2025,265],[2200,340],[2510,335],[2560,335],[2755,280],[2800,280],[2920,425]],
  boxes: [
    { x: 150, y: 390, reward: "growth" },
    { x: 1590, y: 390, reward: "coins" },
    { x: 2940, y: 390, reward: "fire" },
  ],
  enemies: [{x:620,y:432,min:575,max:715,speed:45},{x:1040,y:432,min:985,max:1430,speed:52},{x:1800,y:432,min:1640,max:2190,speed:55},{x:2600,y:432,min:2380,max:2900,speed:62}],
};

const ruins = {
  name: "חורבות השקיעה",
  width: 4000,
  platforms: [
    ground(570), {x:690,y:474,w:365,h:100,type:"ground"}, {x:1170,y:474,w:370,h:100,type:"ground"},
    {x:1660,y:474,w:380,h:100,type:"ground"}, {x:2160,y:474,w:370,h:100,type:"ground"},
    {x:2660,y:474,w:390,h:100,type:"ground"}, {x:3180,y:474,w:820,h:100,type:"ground"},
    {x:200,y:385,w:105,h:24,type:"brick"}, {x:370,y:315,w:110,h:24,type:"grass"},
    {x:730,y:360,w:115,h:24,type:"grass"}, {x:900,y:295,w:110,h:24,type:"brick"},
    {x:1210,y:375,w:110,h:24,type:"brick"}, {x:1390,y:305,w:125,h:24,type:"grass"},
    {x:1705,y:365,w:115,h:24,type:"grass"}, {x:1875,y:295,w:115,h:24,type:"brick"},
    {x:2210,y:370,w:110,h:24,type:"brick"}, {x:2385,y:300,w:120,h:24,type:"grass"},
    {x:2710,y:360,w:115,h:24,type:"grass"}, {x:2890,y:290,w:120,h:24,type:"brick"},
    {x:3230,y:370,w:115,h:24,type:"brick"}, {x:3420,y:300,w:120,h:24,type:"grass"},
    {x:3640,y:365,w:130,h:24,type:"brick"},
  ],
  coins: [[225,345],[400,275],[445,275],[765,320],[930,255],[970,255],[1245,335],[1435,265],[1480,265],[1740,325],[1915,255],[1955,255],[2240,330],[2425,260],[2465,260],[2750,320],[2930,250],[2975,250],[3270,330],[3460,260],[3505,260],[3690,325],[3890,425]],
  boxes: [
    { x: 150, y: 390, reward: "growth" },
    { x: 320, y: 390, reward: "coins" },
    { x: 3550, y: 390, reward: "fire" },
  ],
  enemies: [{x:430,y:432,min:375,max:535,speed:78},{x:825,y:432,min:710,max:1010,speed:90},{x:1330,y:432,min:1190,max:1510,speed:92},{x:1810,y:432,min:1680,max:2000,speed:96},{x:2310,y:432,min:2190,max:2490,speed:102},{x:2800,y:432,min:2690,max:3000,speed:108},{x:3360,y:432,min:3210,max:3500,speed:112},{x:3740,y:432,min:3600,max:3930,speed:118}],
};

export const levels = [meadow, caveLevel, ruins];
