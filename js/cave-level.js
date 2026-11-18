const floor = (x, w) => ({ x, y: 474, w, h: 110, type: "stone" });
const ledge = (x, y, w, type = "stone") => ({ x, y, w, h: 22, type, oneWay: true });
const door = (x, area, targetX, label, options = {}) => ({
  x, y: 389, w: 62, h: 85, label, ...options,
  destination: { area, x: targetX, y: 436 },
});

export const caveLevel = {
  name: "The Hollow Below",
  underground: true,
  startArea: 0,
  areas: [
    {
      name: "A · Cave Entrance",
      width: 1020,
      platforms: [
        floor(0, 1020), ledge(185, 394, 128), ledge(385, 340, 112),
        ledge(590, 385, 138), ledge(762, 328, 112),
      ],
      coins: [[216,350],[260,350],[420,296],[458,296],[630,341],[674,341],[800,286]],
      tunnels: [door(910, 1, 90, "Enter the first tunnel")],
      checkpoints: [{ x: 180, y: 436 }, { x: 515, y: 436 }],
      stalactites: [{ x: 350, y: 78 }, { x: 710, y: 48 }],
      torches: [[120, 330],[470, 240],[820, 245]],
      crystals: [[285, 430,"#68dafa"],[655, 427,"#bd82ff"]],
      mushrooms: [[300, 451,"#eb7390"],[880, 450,"#7ce4bc"]],
    },
    {
      name: "B · First Tunnel",
      width: 940,
      platforms: [
        floor(0, 940), ledge(222, 408, 115), ledge(440, 363, 100),
        ledge(626, 405, 122),
      ],
      coins: [[250,364],[475,319],[663,361]],
      tunnels: [
        door(26, 0, 835, "Back to the cave entrance"),
        door(850, 2, 88, "Into the toad caves"),
      ],
      torches: [[170, 315],[515, 278],[770, 320]],
      crystals: [[355, 437,"#72dafa"]],
      mushrooms: [[565, 451,"#e888bc"]],
    },
    {
      name: "C · Fire Toad Territory",
      width: 1150,
      platforms: [
        floor(0, 1150), ledge(205, 397, 118), ledge(416, 346, 138),
        ledge(655, 388, 124), ledge(844, 328, 144),
      ],
      coins: [[238,353],[459,302],[500,302],[694,344],[882,284],[927,284]],
      tunnels: [
        door(26, 1, 805, "Back to the first tunnel"),
        door(1060, 3, 92, "Down to the lava crossing"),
      ],
      fireToads: [
        { x: 340, y: 432, min: 275, max: 490, speed: 28, range: 390, cooldown: 1.6 },
        { x: 720, y: 432, min: 645, max: 835, speed: 34, range: 430, cooldown: 1.2 },
      ],
      checkpoints: [{ x: 80, y: 436 }, { x: 590, y: 436 }],
      stalactites: [{ x: 550, y: 60 }, { x: 980, y: 42 }],
      torches: [[160, 312],[585, 258],[940, 247]],
      crystals: [[260, 440,"#75dafa"],[760, 432,"#ff9b67"]],
      mushrooms: [[520, 451,"#df7195"]],
    },
    {
      name: "D · Lava Crossing",
      width: 1450,
      platforms: [
        floor(0, 420), floor(590, 280), floor(1090, 360),
        ledge(633, 393, 92), ledge(1140, 371, 116),
      ],
      movingPlatforms: [
        { x: 465, y: 414, w: 92, h: 18, range: 48, speed: 1.05, phase: 0.4 },
        { x: 875, y: 411, w: 98, h: 18, range: 82, speed: 0.9, phase: 1.8 },
      ],
      lava: [{ x: 420, y: 451, w: 170, h: 100 }, { x: 870, y: 451, w: 220, h: 100 }],
      coins: [[256,430],[444,376],[490,375],[565,376],[650,347],[715,347],[841,372],[930,370],[1000,370],[1165,325],[1210,325],[1280,430]],
      tunnels: [
        door(26, 2, 1015, "Back to the toad caves"),
        door(715, 4, 90, "Secret bonus room", { secret: true }),
        door(1352, 5, 88, "Escape toward the surface"),
      ],
      checkpoints: [{ x: 105, y: 436 }, { x: 630, y: 436 }, { x: 1110, y: 436 }],
      stalactites: [{ x: 335, y: 55 }, { x: 685, y: 44 }, { x: 1180, y: 50 }],
      fireTraps: [{ x: 790, y: 451, w: 44, h: 24, period: 3.8, activeFor: 1.25, phase: 1.1 }],
      torches: [[170, 316],[620, 280],[1115, 250]],
      crystals: [[350, 433,"#75dafa"],[760, 430,"#ff9558"],[1235, 428,"#c28cff"]],
      mushrooms: [[285, 451,"#f07892"],[1040, 451,"#7de1bd"]],
    },
    {
      name: "E · Hidden Cache",
      width: 640,
      platforms: [floor(0, 640), ledge(182, 378, 115), ledge(380, 337, 128)],
      coins: [[138,421],[186,421],[228,336],[266,336],[401,294],[449,294],[525,430],[552,430]],
      tunnels: [door(26, 3, 790, "Return to the lava crossing")],
      torches: [[152, 300],[445, 258]],
      crystals: [[320, 433,"#85e4ff"]],
      mushrooms: [[565, 451,"#f17da3"]],
      secretRoom: true,
    },
    {
      name: "F · Final Escape",
      width: 1450,
      platforms: [
        floor(0, 330), floor(505, 245), floor(830, 230), floor(1190, 260),
        ledge(355, 410, 88, "crumble"), ledge(672, 377, 92, "crumble"),
        ledge(922, 355, 98), ledge(1094, 400, 70, "crumble"),
      ],
      movingPlatforms: [{ x: 716, y: 421, w: 82, h: 18, range: 35, speed: 1.1, phase: 0.8 }],
      lava: [{ x: 330, y: 451, w: 175, h: 100 }, { x: 750, y: 451, w: 80, h: 100 }, { x: 1060, y: 451, w: 130, h: 100 }],
      coins: [[175,426],[366,366],[415,366],[552,420],[700,331],[946,310],[1110,354],[1255,430],[1320,430]],
      tunnels: [door(26, 3, 1305, "Back to the lava crossing")],
      checkpoints: [{ x: 100, y: 436 }, { x: 645, y: 436 }, { x: 1015, y: 436 }],
      stalactites: [{ x: 270, y: 47 }, { x: 565, y: 56 }, { x: 885, y: 45 }, { x: 1150, y: 52 }],
      fireTraps: [
        { x: 560, y: 451, w: 42, h: 24, period: 3.4, activeFor: 1.15, phase: 0.4 },
        { x: 965, y: 451, w: 42, h: 24, period: 3.7, activeFor: 1.2, phase: 2 },
      ],
      fireToads: [{ x: 930, y: 432, min: 865, max: 1010, speed: 31, range: 360, cooldown: 1.1 }],
      torches: [[160, 310],[600, 270],[940, 250],[1270, 300]],
      crystals: [[418, 430,"#76dcfa"],[800, 432,"#ff9858"],[1110, 430,"#c88cff"]],
      mushrooms: [[470, 451,"#e9789a"],[1045, 451,"#87e2bc"]],
      finishX: 1375,
    },
  ],
};
