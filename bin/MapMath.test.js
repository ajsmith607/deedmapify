const fs = require("fs")
process.env["NODE_DEV"] = "TEST";
const MapMath = require("./MapMath")
const logall = MapMath.logall;

// many functions in the package under test do round-trip conversions
// so create a general approach to going through test cases
function singletest(result, test) {
    console.log("testing test: %s, result: %s", test, result);
    if (typeof test === "number") { expect(result).toBeCloseTo(test); } 
    else { expect(result).toStrictEqual(test); }
}
function testthese (result, test) {
    if (test && Array.isArray(test)) {
        expect(result && Array.isArray(result)).toBe(true);
        for (let i=0; i < test.length; i++) {
            singletest(result[i], test[i]);
        }
    } else { singletest(result, test); }
}
function RunTestMap(testMap, desc, forwardfcn, backfcn) {
    test(desc, () => {
        for (let [key, value] of testMap) {
            if (forwardfcn) { testthese(forwardfcn(key), value); }
            if (backfcn) { testthese(backfcn(value), key); }
        }
    });
}

const roundingmap = new Map();
roundingmap.set(4.39822971502571, 4.40); 
roundingmap.set(5.654866776461628, 5.65); 
roundingmap.set(3.7699111843077517, 3.77); 
roundingmap.set(0.6283185307179586, 0.63); 
roundingmap.set(2.5132741228718345, 2.51); 
roundingmap.set(1.8849555921538759, 1.88); 
roundingmap.set(1.2566370614359172, 1.26); 
roundingmap.set(5.026548245743669, 5.03); 
roundingmap.set(3.141592653589793, 3.14); 
RunTestMap(roundingmap, "Test rounding function", MapMath.rounddown); 

// test type safety
expect(MapMath.rounddown(MapMath.degstorads("44.69"))).toBe(MapMath.rounddown(0.7799876)); 
expect(MapMath.rounddown(MapMath.radstodegs(".78"))).toBe(MapMath.rounddown(44.69071)); 
const normdegmap= new Map();
normdegmap.set(5, 5); 
normdegmap.set(-10, 350); 
normdegmap.set(720, 0); 
normdegmap.set(-360, 0); 
RunTestMap(normdegmap, "Test normalizing degrees", MapMath.normalizedegrees); 

const degtoradmap = new Map();
degtoradmap.set(252, 4.39822971502571); 
degtoradmap.set(324, 5.654866776461628); 
degtoradmap.set(216, 3.7699111843077517); 
degtoradmap.set(36, 0.6283185307179586); 
degtoradmap.set(144, 2.5132741228718345); 
degtoradmap.set(108, 1.8849555921538759); 
degtoradmap.set(72, 1.2566370614359172); 
degtoradmap.set(288, 5.026548245743669); 
degtoradmap.set(180, 3.141592653589793); 
RunTestMap(degtoradmap, "Test converting between degrees and radians", 
           MapMath.degstorads, MapMath.radstodegs); 

const degvals = new Map();
degvals.set("15", 15);
degvals.set("30", 30);
degvals.set("45,30", 45.5);
degvals.set("210,45", 210.75);
degvals.set("-5,45", -5.75);
RunTestMap(degvals, "Test converting between degrees,minutes,seconds and decimal angle", 
           MapMath.degstodecs, MapMath.decstodegs); 

const azsvgmap= new Map();
azsvgmap.set(0,90);
azsvgmap.set(90,0);
azsvgmap.set(180,270);
azsvgmap.set(270,180);
azsvgmap.set(350,100);
azsvgmap.set(10,80);
RunTestMap(azsvgmap, "Test converting between Azimuth and SVG angles", MapMath.AzimuthtoSVG, MapMath.SVGtoAzimuth); 
expect(MapMath.AzimuthtoSVG(-10)).toBe(100);
expect(MapMath.AzimuthtoSVG(450)).toBe(0);

const linkstochainsmap = new Map();
linkstochainsmap.set(483, 4.83);
linkstochainsmap.set(82, 0.82);
linkstochainsmap.set("310", 3.10);
RunTestMap(linkstochainsmap, "Test converting links to raw chains", MapMath.linkstochains);

const normlinkstochainsmap = new Map();
normlinkstochainsmap.set(4.83, [4,83]);
normlinkstochainsmap.set(0.82, [0,82]);
normlinkstochainsmap.set("3.10", [3,10]);
RunTestMap(normlinkstochainsmap, "Test converting links to normalized chains", MapMath.normalizechains);

const chainstolinksmap = new Map();
chainstolinksmap.set(4.83, 483);
chainstolinksmap.set(0.82, 82);
chainstolinksmap.set("3.10", 310);
RunTestMap(chainstolinksmap, "Test converting chains to raw links", MapMath.chainstolinks);

const normchainstolinksmap = new Map();
normlinkstochainsmap.set(4.83, [4,83]);
normlinkstochainsmap.set(0.82, [0,82]);
normlinkstochainsmap.set("3.10", [3,10]);
RunTestMap(normchainstolinksmap, "Test converting chains to normalized links", MapMath.normalizelinks);

test("Test converting chains and links to normalized chains and links.", () => {
    expect(MapMath.normalizechainsandlinks(4.83,107)).toStrictEqual([5,90]);  
    expect(MapMath.normalizechainsandlinks(4.83,127)).toStrictEqual([6,10]);  
    expect(MapMath.normalizechainsandlinks(5,82)).toStrictEqual([5,82]);
    expect(MapMath.normalizechainsandlinks("3.10",250)).toStrictEqual([5,60]);
    expect(MapMath.normalizechainsandlinks(3.10,"250")).toStrictEqual([5,60]);
    expect(MapMath.normalizechainsandlinks(3.10,"-150")).toStrictEqual([1,60]);
    expect(MapMath.normalizechainsandlinks(3.10,-150)).toStrictEqual([1,60]);
});

const feettolinksmap = new Map();
feettolinksmap.set(152, 100.32);
feettolinksmap.set(483, 318.78);
feettolinksmap.set(37, 2442);
feettolinksmap.set(100, 6600);
feettolinksmap.set(833, 5301.78);
RunTestMap(feettolinksmap, "Test converting between links and feet", MapMath.linkstofeet, MapMath.feettolinks);

const feettochainslinksmap = new Map();
feettochainslinksmap.set(66, [1,0]);
feettochainslinksmap.set(99, [1,50]);
feettochainslinksmap.set(100, [1,51.52]);
feettochainslinksmap.set(318.78, [4,83]);
feettochainslinksmap.set(2442, [37,0]);
feettochainslinksmap.set(6600, [100,0]);
feettochainslinksmap.set(5301.78,[80,33]);
RunTestMap(feettochainslinksmap, "Test converting feet to normalized chains and links", MapMath.fromfeet);

test("Test converting chains and links to feet", () => {
    expect(MapMath.tofeet(1,0)).toBeCloseTo(66);
    expect(MapMath.tofeet(1,50)).toBeCloseTo(99);
    expect(MapMath.tofeet(1,52)).toBeCloseTo(100.32);
    expect(MapMath.tofeet(4,83)).toBeCloseTo(318.78);
    expect(MapMath.tofeet(37,0)).toBeCloseTo(2442);
    expect(MapMath.tofeet(100,0)).toBeCloseTo(6600);
    expect(MapMath.tofeet(80,33)).toBeCloseTo(5301.78);
});

test("Test getting feet only from distances", () => {
    expect(MapMath.GetFeetOnly("3 feet")).toBeCloseTo(3);
    expect(MapMath.GetFeetOnly("0.7575758 chains")).toBeCloseTo(50);
    expect(MapMath.GetFeetOnly("1 chain 50 links")).toBeCloseTo(99);
    expect(MapMath.GetFeetOnly("1 chain 100 links -50 links")).toBeCloseTo(99);
});

const distances= new Map();
distances.set("66 feet", { chains: 1, links: 0, feet: 66, linelength: 66 });
distances.set("99 feet", { chains: 1, links: 50, feet: 99, linelength: 99 });
distances.set("66 feet 33 feet", { chains: 1, links: 50, feet: 99, linelength: 99 });
distances.set("1 chains 50 links", { chains: 1, links: 50, feet: 99, linelength: 99 });
distances.set("150 links", { chains: 1, links: 50, feet: 99, linelength: 99 });
distances.set("1.5 chains", { chains: 1, links: 50, feet: 99, linelength: 99 });
distances.set("1 chains 33 feet", { chains: 1, links: 50, feet: 99, linelength: 99 });
distances.set("100 links 33 feet", { chains: 1, links: 50, feet: 99, linelength: 99 });
distances.set("100 links 33 feet -33 feet 33 feet", { chains: 1, links: 50, feet: 99, linelength: 99 });
RunTestMap(distances, "Test given distance, get all distance equivalents", MapMath.GetAllDistanceInfo);

const bearings = new Map();
bearings.set("n 52 e", 52);
bearings.set("n 52 w", 308);
bearings.set("n 35,30 w", 324.5);
bearings.set("s 52 e", 128);
bearings.set("s 52 w", 232);
RunTestMap(bearings, "Test converting between compass bearings and azimuth", MapMath.BearingtoAzimuth, MapMath.AzimuthtoBearing);

test("Test edge cases of bearings and azimuth", () => {

    expect(MapMath.BearingtoAzimuth("a 0 z")).toBe(0); 
    expect(MapMath.BearingtoAzimuth("a 90 z")).toBe(90); 
    expect(MapMath.BearingtoAzimuth("a 183.3 z")).toBe(183.3); 
    
    expect(MapMath.BearingtoAzimuth("n 0 e")).toBe(0); 
    expect(MapMath.BearingtoAzimuth("n 0 w")).toBe(0); 
    expect(MapMath.BearingtoAzimuth("n 15,30 w")).toBe(344.5); 
    expect(MapMath.BearingtoAzimuth("n 90 e")).toBe(90); 
    expect(MapMath.BearingtoAzimuth("s 90 e")).toBe(90); 
    expect(MapMath.BearingtoAzimuth("s 0 e")).toBe(180); 
    expect(MapMath.BearingtoAzimuth("s 0 w")).toBe(180); 
    expect(MapMath.BearingtoAzimuth("n 90 w")).toBe(270); 
    expect(MapMath.BearingtoAzimuth("s 90 w")).toBe(270); 
    
    expect(MapMath.AzimuthtoBearing(0)).toBe("n 0 e"); 
    expect(MapMath.AzimuthtoBearing(90)).toBe("n 90 e"); 
    expect(MapMath.AzimuthtoBearing(180)).toBe("s 0 e"); 
    expect(MapMath.AzimuthtoBearing(270)).toBe("s 90 w"); 
    expect(MapMath.AzimuthtoBearing(360)).toBe("n 0 w"); 
});

const backazmap= new Map();
backazmap.set(0, 180);
backazmap.set(90, 270);
backazmap.set(30, 210);
backazmap.set(120, 300);
RunTestMap(backazmap, "Test converting between azimuth and back azimuth", MapMath.GetBackAzumuth, MapMath.GetBackAngle);

const backbearingmap = new Map();
backbearingmap.set("n 52 e", "s 52 w");
backbearingmap.set("n 52 w", "s 52 e");
backbearingmap.set("n 35,30 w", "s 35,30 e");
backbearingmap.set("s 52 e", "n 52 w");
backbearingmap.set("s 52 w", "n 52 e");
RunTestMap(backbearingmap, "Test converting between bearings and back bearings", MapMath.GetBackBearing);

test("Test right angle detection and average angle calculation", () => {
    const badcases= [
        { angle1: 0, angle2: 45 },
        { angle1: 0, angle2: 180 },
        { angle1: 275, angle2: 180 },
        { angle1: 0, angle2: 200 },
        { angle1: 35, angle2: 135 },
        { angle1: 105, angle2: 45 }
    ];

    const testcases = [
        { angle1: 0, angle2: 90, expected: 45},
        { angle1: 0, angle2: 270, expected: 315},
        { angle1: 180, angle2: 90, expected: 135},
        { angle1: 180, angle2: 270, expected: 225},
        { angle1: 90, angle2: 0, expected: 45},
        { angle1: 90, angle2: 180, expected: 135},
        { angle1: 270, angle2: 0, expected: 315},
        { angle1: 270, angle2: 180, expected: 225}, 
        { angle1: 99, angle2: 9, expected: 54}
    ];

    for (let i=0; i < badcases.length; i++) {
        let angle1 = badcases[i].angle1;
        let angle2 = badcases[i].angle2; 
        expect(MapMath.AreAnglesRight(angle1, angle2)).toBe(false); 
    }

    for (let i=0; i < testcases.length; i++) {
        let angle1 = testcases[i].angle1;
        let angle2 = testcases[i].angle2;
        let expected = testcases[i].expected;
        expect(MapMath.AreAnglesRight(angle1, angle2)).toBe(true); 
        let result2 = MapMath.GetInsideAverageAngle(angle1, angle2);
        expect(result2).toBe(expected);
    }

});

test("Test intersections, perpendicularity, parallelism of line-like objects", () => {
    let line1 = { points: [{ x: 2, y: 0 }, { x: 4, y: 0 }] };
    let line2 = { points: [{ x: 2, y: -2 }, { x: 2, y: 2 }] };
    expect(MapMath.AreLinesRight(line1, line2)).toBe(true);
    expect(MapMath.AreLinesParallel(line1, line2)).toBe(false);

    let angle1 = MapMath.GetAngleOfLine(line1);
    expect(angle1).toStrictEqual(0);
    let angle2 = MapMath.GetBackAngle(MapMath.GetAngleOfLine(line2));
    expect(angle2).toStrictEqual(270);
    expect(MapMath.AreAnglesRight(angle1, angle2)).toBe(true);
    
    let dist1= MapMath.GetDistanceOfLine(line1);
    expect(dist1).toStrictEqual(2);
    let dist2= MapMath.GetDistanceOfLine(line2);
    expect(dist2).toStrictEqual(4);

    let intersectionpoint = MapMath.GetIntersectionPoint(line1,line2);
    expect(intersectionpoint).toStrictEqual({x: 2, y: 0});
    expect(MapMath.IsPointOnLine(3,0,line1)).toBe(true);
    
    // verify these functions are point order agnostic 
    let continues1 = MapMath.DoesLineContinueGivenPoints(intersectionpoint,line1.points[0],line1.points[1]);
    expect(continues1).toBe(false);
    continues1 = MapMath.DoesLineContinueGivenPoints(intersectionpoint,line1.points[1],line1.points[0]);
    expect(continues1).toBe(false);
    continues1 = MapMath.DoesLineContinue(line1, intersectionpoint);
    expect(continues1).toBe(false);

    let continues2 = MapMath.DoesLineContinueGivenPoints(intersectionpoint,line2.points[0],line2.points[1]);
    expect(continues2).toBe(true);
    continues2 = MapMath.DoesLineContinueGivenPoints(intersectionpoint,line2.points[1],line2.points[0]);
    expect(continues2).toBe(true);
    continues2 = MapMath.DoesLineContinue(line2, intersectionpoint);
    expect(continues2).toBe(true);

    expect(MapMath.IsPointOnLine(3,0,line1)).toBe(true);
    expect(MapMath.IsPointOnLine(6,0,line1)).toBe(false);
    expect(MapMath.IsPointOnLine(2,0,line2)).toBe(true);
    expect(MapMath.IsPointOnLine(3,0,line2)).toBe(false);

    line1 = { points: [{ x: 0, y: 0 }, { x: 4, y: 0 }] };
    line2 = { points: [{ x: 2, y: -2 }, { x: 2, y: 2 }] };
    expect(MapMath.GetIntersectionPoint(line1,line2)).toStrictEqual({x: 2, y: 0});
    
    line1 = { points: [{ x: 0, y: 2 }, { x: 4, y: 2 }] };
    line2 = { points: [{ x: 4, y: 2 }, { x: 4, y: 0 }] };
    expect(MapMath.GetIntersectionPoint(line1,line2)).toStrictEqual({x: 4, y: 2});
    expect(MapMath.AreLinesRight(line1,line2)).toBe(true);
   
    continues1 = MapMath.DoesLineContinueGivenPoints(intersectionpoint,line1.points[1],line1.points[0]);
    expect(continues1).toBe(false);
    continues1 = MapMath.DoesLineContinueGivenPoints(intersectionpoint,line1.points[0],line1.points[1]);
    expect(continues1).toBe(false);
    continues2 = MapMath.DoesLineContinue(line2, intersectionpoint);
    expect(continues2).toBe(false);

    let line3 = { points: [{ x: 2, y: 4 }, { x: 2 , y: 1 }] };
    intersectionpoint = MapMath.GetIntersectionPoint(line1,line3);
    expect(intersectionpoint).toStrictEqual({x: 2, y: 2});
    expect(MapMath.AreLinesParallel(line2,line3)).toBe(true);
    expect(MapMath.AreLinesRight(line1,line2)).toBe(true);
    expect(MapMath.AreLinesRight(line1,line3)).toBe(true);
    
    let continues3 = MapMath.DoesLineContinueGivenPoints(intersectionpoint,line3.points[0],line3.points[1]);
    expect(continues3).toBe(true);
    continues3 = MapMath.DoesLineContinueGivenPoints(intersectionpoint,line3.points[1],line3.points[0]);
    expect(continues3).toBe(true);
    continues3 = MapMath.DoesLineContinue(line3, intersectionpoint);
    expect(continues3).toBe(true);
});


function CartCoordstoSVGCoords(point) {
    if (point.y) { point.y = -point.y; }
    return point;
}
// for the same of clarity
function SVGCoordstoCartCoords(point) {
    if (point.y) { point.y = -point.y; }
    return point;
}


expect(MapMath.CartCoordstoSVGCoords({x:100, y:120})).toStrictEqual({x:100, y:-120});
//expect(MapMath.SVGCoordstoCartCoords({x:100, y:120})).toStrictEqual({x:100, y:-120});
// TODO revisit this!

const cartmap = new Map();
cartmap.set({x:0, y:0}, {x:0, y:0}); 
//cartmap.set({x:120, y:100}, {x:120, y:-100}); 
//cartmap.set({x:-120, y:-100}, {x:-120, y:100}); 
//RunTestMap(cartmap, "Test converting Cartesian coordinates to SVG equivalent", MapMath.CartCoordstoSVGCoords, MapMath.SVGCoordstoCartCoords); 
let point = {x:100, y:120}; 
//expect(MapMath.CartCoordstoSVGCoords(point)).toStrictEqual({x:100, y:-120});
//expect(MapMath.SVGCoordstoCartCoords(point)).toStrictEqual({x:100, y:-120});

/*
test("Test converting Cartesian coordinates to SVG equivalent ", () => {
    let point = {x:0,y:0};
    // function SVGCoordstoCartCoords(point) {
    expect(MapMath.CartCoordstoSVGCoords(point)).toStrictEqual({x:0, y:0});
    point = {x:120, y:100};
    expect(MapMath.CartCoordstoSVGCoords(point)).toStrictEqual({x:120, y:-100});
    point = {x:-120, y:-100};
    expect(MapMath.CartCoordstoSVGCoords(point)).toStrictEqual({x:-120, y:100});
});
*/


test("Test moving and rotating points", () => {
    expect(MapMath.MoveAndRotatePoint(120,100,0,0)).toStrictEqual({x:120,y:100});
    expect(MapMath.MoveAndRotatePoint(120,100)).toStrictEqual({x:120,y:100});
    expect(MapMath.MoveAndRotatePoint(120,100,20,15)).toStrictEqual({x:140,y:115});
    expect(MapMath.MoveAndRotatePoint(120,100,-20,-15)).toStrictEqual({x:100,y:85});
    
    expect(MapMath.MoveAndRotatePoint(120,100,0,0,90)).toStrictEqual({x:-100,y:-120});
    expect(MapMath.MoveAndRotatePoint(120,100,5,10,90)).toStrictEqual({x:-95,y:-110});
    expect(MapMath.MoveAndRotatePoint(120,100,10,5,90)).toStrictEqual({x:-90,y:-115});
    expect(MapMath.MoveAndRotatePoint(120,100,5,-10,90)).toStrictEqual({x:-95,y:-130});
    expect(MapMath.MoveAndRotatePoint(120,100,-5,10,90)).toStrictEqual({x:-105,y:-110});
    expect(MapMath.MoveAndRotatePoint(120,100,-10,5,90)).toStrictEqual({x:-110,y:-115});
    expect(MapMath.MoveAndRotatePoint(120,100,10,-5,90)).toStrictEqual({x:-90,y:-125});
});

test("Test fuzzy offset", () => {
    let space = 6;
    let [angle1, angle2] = [0,0]; 
    
    [angle1, angle2] = [0,30]; 
    expect(MapMath.GetFuzzyLabelOffset(angle1, angle2, space)).toStrictEqual({x:space,y:space});
    [angle1, angle2] = [30,0]; 
    expect(MapMath.GetFuzzyLabelOffset(angle1, angle2, space)).toStrictEqual({x:-space,y:-space});

    [angle1, angle2] = [0,130]; 
    expect(MapMath.GetFuzzyLabelOffset(angle1, angle2, space)).toStrictEqual({x:space,y:space});
    [angle1, angle2] = [130,0]; 
    expect(MapMath.GetFuzzyLabelOffset(angle1, angle2, space)).toStrictEqual({x:-space,y:-space});
    
    [angle1, angle2] = [0,230]; 
    expect(MapMath.GetFuzzyLabelOffset(angle1, angle2, space)).toStrictEqual({x:space,y:-space});
    [angle1, angle2] = [230,0]; 
    expect(MapMath.GetFuzzyLabelOffset(angle1, angle2, space)).toStrictEqual({x:-space,y:space});
    
    [angle1, angle2] = [0,330]; 
    expect(MapMath.GetFuzzyLabelOffset(angle1, angle2, space)).toStrictEqual({x:space,y:-space});
    [angle1, angle2] = [330,0]; 
    expect(MapMath.GetFuzzyLabelOffset(angle1, angle2, space)).toStrictEqual({x:-space,y:space});
});

function updatebearings(line, magdecl, rotation) {
    line.az = MapMath.rounddown(MapMath.normalizedegrees(line.az + magdecl));
    line.baz = MapMath.GetBackAngle(line.az);
    line.lineangle = MapMath.rounddown(MapMath.normalizedegrees(MapMath.AzimuthtoSVG(line.az + rotation)));
    line.blineangle = MapMath.GetBackAngle(line.lineangle);
    line.bearing = MapMath.AzimuthtoBearing(line.az);
    line.bbearing = MapMath.GetBackBearing(line.bearing);
    return line;
}

test("Test getting all bearings info", () => {

    let magdecl=0;
    let rot = 0;
    let bearing = "n 52 e";
    let line = {}
    line = {az: 52,
            baz: 232,
            lineangle: 38,
            blineangle: 218,
            bearing: "n 52 e",
            bbearing: "s 52 w"};
    let result = MapMath.GetAllBearingInfo(bearing, magdecl, rot);
    expect(result).toStrictEqual(line);

    magdecl = -6;
    rot = 0;
    bearing = "n 52 e";
    line = {az: 46,
            baz: 226,
            lineangle: 44,
            blineangle: 224,
            bearing: "n 46 e",
            bbearing: "s 46 w"};
    result = MapMath.GetAllBearingInfo(bearing, magdecl, rot);
    expect(result).toStrictEqual(line);

    magdecl = 8;
    rot = -10;
    bearing = "n 52 e";
    line = {az: 60,
            baz: 240, 
            lineangle: 40,
            blineangle: 220,
            bearing: "n 60 e",
            bbearing: "s 60 w"};
    result = MapMath.GetAllBearingInfo(bearing, magdecl, rot);
    expect(result).toStrictEqual(line);

    magdecl = 8;
    rot = -10;
    bearing = "n 52 w";
    line = {az: 316,
            baz: 136,
            lineangle: 144,
            blineangle: 324,
            bearing: "n 44 w",
            bbearing: "s 44 e"};
    result = MapMath.GetAllBearingInfo(bearing, magdecl, rot);
    expect(result).toStrictEqual(line);

    magdecl = -6; 
    rot = 0;
    bearing = "n 52 w";
    line = {az: 302,
            baz: 122,
            lineangle: 148,
            blineangle: 328,
            bearing: "n 58 w",
            bbearing: "s 58 e"};
    result = MapMath.GetAllBearingInfo(bearing, magdecl, rot);
    expect(result).toStrictEqual(line);

    magdecl = 0; 
    rot = -10; 
    bearing = "n 52 w";
    line = {az: 308,
            baz: 128,
            lineangle: 152,
            blineangle: 332,
            bearing: "n 52 w",
            bbearing: "s 52 e"};
    result = MapMath.GetAllBearingInfo(bearing, magdecl, rot);
    expect(result).toStrictEqual(line);

    // new tests
    magdecl = 0;
    rot = 20;
    bearing = "a 52 z";
    line = {az: 52,
            baz: 232,
            lineangle: 18,
            blineangle: 198,
            bearing: "n 52 e",
            bbearing: "s 52 w"};
    result = MapMath.GetAllBearingInfo(bearing, magdecl, rot);
    expect(result).toStrictEqual(line);

    magdecl = -10;
    rot = 20;
    bearing = "a 53 z";
    line = {az: 43,
            baz: 223,
            lineangle: 27,
            blineangle: 207,
            bearing: "n 43 e",
            bbearing: "s 43 w"};
    result = MapMath.GetAllBearingInfo(bearing, magdecl, rot);
    expect(result).toStrictEqual(line);
    
    magdecl = 0;
    rot = 20;
    bearing = "t 53 n";
    line = {az: 53,
            baz: 233,
            lineangle: 17,
            blineangle: 197,
            bearing: "n 53 e",
            bbearing: "s 53 w"};
    result = MapMath.GetAllBearingInfo(bearing, magdecl, rot);
    expect(result).toStrictEqual(line);
    
    magdecl = -10;
    rot = -20;
    bearing = "t 53 n";
    line = {az: 53,
            baz: 233,
            lineangle: 57,
            blineangle: 237,
            bearing: "n 53 e",
            bbearing: "s 53 w"};
    result = MapMath.GetAllBearingInfo(bearing, magdecl, rot);
    expect(result).toStrictEqual(line);
});


test("Test getting bearings from points", () => {

    let [x1, y1, x2, y2] = [0,0, 100,0];

    [x2, y2] = [100,0];
    expect(MapMath.GetBearingsFromPoints(x1,y1,x2,y2)).toStrictEqual("n 90 e");
    
    [x2, y2] = [0,100];
    expect(MapMath.GetBearingsFromPoints(x1,y1,x2,y2)).toStrictEqual("s 0 e");

    [x2, y2] = [0,100];
    expect(MapMath.GetBearingsFromPoints(x1,y1,x2,y2)).toStrictEqual("s 0 e");

    [x2, y2] = [0,100];
    expect(MapMath.GetBearingsFromPoints(x1,y1,x2,y2)).toStrictEqual("s 0 e");
});


test("Test getting endpoint", () => {
    // GetEndPoint (x1, y1, angle, dist) {
    let [x,y] = [0,0];
    let dist = 100 
    let angle=90;
   
    let svgangle = MapMath.AzimuthtoSVG(angle);
    logall({angle},{svgangle});
    let coords = MapMath.GetEndPoint(x,y,svgangle,dist);
    expect(coords).toStrictEqual({x:100,y:0});
    expect(MapMath.GetAngleFromPoints(x,y,coords.x,coords.y)).toStrictEqual(svgangle);
    expect(MapMath.GetDistanceFromPoints(x,y,coords.x,coords.y)).toStrictEqual(100);        
   
    x = -100; y = -120;
    expect(MapMath.GetEndPoint(x,y,svgangle,dist)).toStrictEqual({x:0,y:-120});
});


test("Test bounding box rotation calculations", () => {

    let bbox = { minx: 0, miny: 0, maxx: 120, maxy: 100 };

    rotbbox = MapMath.RotateBoundingBox(bbox, 90);
    expect(rotbbox).toStrictEqual({minx:10,miny:-10,maxx:110,maxy:110});

});


test("Test point labelling scheme ", () => {
    expect(MapMath.numberletter(1)).toBe("A");
    expect(MapMath.numberletter(2)).toBe("B");
    expect(MapMath.numberletter(26)).toBe("Z"); 
    expect(MapMath.numberletter(27)).toBe("AA");
    expect(MapMath.numberletter(28)).toBe("AB"); 
    expect(MapMath.numberletter(52)).toBe("AZ");
    expect(MapMath.numberletter(53)).toBe("BA");
    expect(MapMath.numberletter(54)).toBe("BB"); 
});


test("Test layer hierarchy", () => {
    let strandedparent = {id: "strandedparent", prop1: "stranded"};
    let parent = {id: "parent", prop1: "prop1fromparent"};
    let child = {id: "child", parentid: "parent", prop2: "prop2fromchild", prop3: "prop3fromchild"};
    let grandchild1 = {id: "grandchild1", parentid: "child"};

    let group = [parent, child, grandchild1];
    group = MapMath.cascadeProperties(group);

    console.log(group);
    for (let g=0; g < group.length; g++) {
        if (group[g].id === "grandchild1") {
            expect(group[g].prop1).toBe("prop1fromparent");
            expect(group[g].prop3).toBe("prop3fromchild");
        }
    }

});

/*
 * test the function containsOnlyLetters(string) in MapMath.js
 */

test("Test containsOnlyLetters(string)", () => {
    expect(MapMath.containsOnlyLetters("abc")).toBe(true);
    expect(MapMath.containsOnlyLetters("abc123")).toBe(false);
    expect(MapMath.containsOnlyLetters("abc123!")).toBe(false);
});
    
test("Test titlecase(word)", () => {
    expect(MapMath.titlecase("abc")).toBe("Abc");
    expect(MapMath.titlecase("abc123")).toBe("Abc123");
    expect(MapMath.titlecase("abc123!")).toBe("Abc123!");
});

test("Test formatDMS(dms)", () => {
    expect(MapMath.formatDMS("0,0,0")).toBe("0° 0' 0\"");
    expect(MapMath.formatDMS("90,60,30")).toBe("90° 60' 30\"");
    expect(MapMath.formatDMS("180,44,44 N")).toBe("180° 44' 44\" N");
    expect(MapMath.formatDMS("270,30,30 w")).toBe("270° 30' 30\" W");
});

test("Test squareFeetToAcres(squareFeet)", () => {
    expect(MapMath.squareFeetToAcres(10890.01)).toBe(0.25);
    expect(MapMath.squareFeetToAcres(21780.02)).toBe(0.50);
    expect(MapMath.squareFeetToAcres(43560.04)).toBe(1);
});

test("Test polygon functions", () => {
    const lines = [];
    expect(MapMath.isClosedPolygon(lines)).toBe(false);

    let line = {points:[{x:0,y:0},{x:100,y:0}]}; 
    lines.push(line);
    line = {points: [{x:100,y:0},{x:100,y:100}]};
    lines.push(line);
    expect(MapMath.isClosedPolygon(lines)).toBe(false);

    line = {points: [{x:100,y:100},{x:0,y:100}]};
    lines.push(line);
    expect(MapMath.isClosedPolygon(lines)).toBe(false);

    line = {points: [{x:0,y:100},{x:0,y:0}]};
    lines.push(line);

    expect(MapMath.isClosedPolygon(lines)).toBe(true);

    expect(MapMath.getPolygonCartCenterPoint(lines)).toStrictEqual({x:50,y:-50});
    expect(MapMath.calculatePolygonArea(lines)).toBe(10000);
});


test("Test GetRatioOfLineLengths", () => {
    let point1 = { x: 0, y: 0 };
    let point2 = { x: 0, y: 1 };
    let point3 = { x: 1, y: 0 };
    let point4 = { x: 1, y: 1 };
    expect(MapMath.GetRatioOfLineLengthsGivenPoints(point1, point2, point3, point4)).toBe(1);

    let line1 = {}; line1.points = [point1, point2];
    let line2 = {}; line2.points = [point3, point4];
    expect(MapMath.GetRatioOfLineLengths(line1, line2)).toBe(1);

    point3 = { x: 1, y: 0 };
    point4 = { x: 1, y: 2 };
    line2.points = [point3, point4];
    expect(MapMath.GetRatioOfLineLengthsGivenPoints(point1, point2, point3, point4)).toBe(2);
    expect(MapMath.GetRatioOfLineLengths(line1, line2)).toBe(2);

    point3 = { x: 1, y: 0 };
    point4 = { x: 1, y: .5 };
    line2.points = [point3, point4];
    expect(MapMath.GetRatioOfLineLengthsGivenPoints(point1, point2, point3, point4)).toBe(.5);
    expect(MapMath.GetRatioOfLineLengths(line1, line2)).toBe(.5);
});




// Test the function with various indices
/*
 * in SVG (Scalable Vector Graphics), rotations are applied counterclockwise for positive values. This means that if you rotate a point around the origin, a positive angle value will result in a counterclockwise rotation. Conversely, a negative angle value would result in a clockwise rotation around the origin. This convention is commonly used in mathematics and computer graphics to define the direction of rotation.
 *
 *
 *on a compass, the azimuth angle 90 degrees is the same as 0 degrees on cartesian coordinates

 *relative degrees on a compass move clockwise for positive values while degrees in cartesian coordinate systems move counter-clockwise for positive values?
 *
 * so, code that has azimuth angle inputs for compass bearings and creates and SVG image, which is based on cartesian coordinates, much account for differences in relative directionality by inverting the sign of the azimuth angles that are input, and rotating the final SVG image by 90 degrees so the coordinate systems match
 *
 *SVG's y-axis is inverted compared to the conventional Cartesian coordinate system, 
 *
 */

