function numberletter (num) { return String.fromCharCode(96 + parseInt(num)); }

function splitwords (line, size=1, spliton=" ") { 
    line = line.toString().toLowerCase();
    const items = line.split(spliton);
    if (size === 1) { return items };
    const result = [];
    for (let i = 0; i < items.length; i += size) {
        result.push(items.slice(i, i + size));
    }
    return result;
}

const path = require("path");
function logall(...args) {
  let [callingfcn, fileName, lineNumber ] = ["", "", ""];
  const stackTrace = new Error().stack;
  if (stackTrace) {
    const stackLines = stackTrace.split('\n');
    const callerLine = stackLines[2]; // 0: Error, 1: getCallerInfo, 2: calling function
    const match = /\s+at (.*) \((.*):(\d+):(\d+)\)/.exec(callerLine);
    if (match) {
      callingfcn = match[1];
      callingfile = path.basename(match[2]);
      callingline = match[3];
      
    }
  }
    let msg = path.basename(callingfile) + "/" + callingfcn + "/" + callingline + ": " ;
    for (a=0; a < args.length; a++) {
        if (a > 0) { msg = msg + ", "; }
        let varname = Object.keys(args[a])[0]; 
        let varvalue = args[a][varname]; 
        msg = msg + varname + ": " + varvalue; 
    }
    console.log(msg);
}

// round down to two decimal places, likely in preparation for display
function rounddown (value) { return (value) ? parseFloat(value.toFixed(2)) : value ;} 
function normalizedegrees(degrees) { return (degrees % 360 + 360) % 360; }

function AzimuthtoSVG (azimuth) { return normalizedegrees(90 - normalizedegrees(azimuth)); }
function SVGtoAzimuth (svgangle) { return normalizedegrees(90 - normalizedegrees(svgangle)); }
function CartCoordstoSVGCoords(point) {
    if (point.y) { point.y = -point.y; }
    return point;
}

// Math functions take radians, not degrees
function degstorads (degrees) { 
    degrees = normalizedegrees(degrees);
    return degrees * (Math.PI / 180); 
}
function radstodegs (radians) { return parseFloat(radians) * (180 / Math.PI); }


function degstodecs (angle) {
    if (parseFloat(angle) == 0) {return 0;}
    angle = angle.toString();
    if (! angle.includes(",")) { return parseFloat(angle); }

    let parts = angle.split(",");
    let deg = parseInt(parts[0]);
    deg = (deg) ? deg : 0;

    let sign = Math.sign(deg);
    deg = Math.abs(deg); 

    let min = parseInt(parts[1]);
    min = (min) ? min: 0;
    let sec = parseInt(parts[2]);
    sec = (sec) ? min: 0;

    let decdeg = (deg + (min / 60) + (sec / 3600)) * sign;
    return decdeg; 
}

function decstodegs (decimalBearing) {
    let sign = Math.sign(decimalBearing);
    decimalBearing = Math.abs(rounddown(parseFloat(decimalBearing)));

    const degrees = Math.trunc(decimalBearing);
    const degreesDecimal = Math.abs(decimalBearing);
    const minutesDecimal = (degreesDecimal - degrees) * 60;
    const minutes = Math.floor(minutesDecimal);
    const secondsDecimal = (minutesDecimal - minutes) * 60;
    const seconds = Math.round(secondsDecimal);
    
    // Handle the cases when minutes or seconds reach 60
    if (seconds === 60) { seconds = 0; minutes += 1; }
    if (minutes === 60) { minutes = 0; degrees += 1; }

    let angle = (sign * degrees).toString();
    if (minutes) { angle = angle + "," + minutes.toString(); }
    if (seconds) { angle = angle + "," + seconds.toString(); }

    return angle;
}

// bearings.set("n 0 w", 360);
function BearingtoAzimuth (bearing) {
    logall({bearing});
    let [primary, angle, secondary] = splitwords(bearing);
    logall({primary},{angle},{secondary});
    let quadrant = primary + secondary;
    let azimuth = degstodecs(angle);

    logall({quadrant},{azimuth});
    if (quadrant === "se") { azimuth = 180 - azimuth} 
    if (quadrant === "sw") { azimuth = 180 + azimuth; } 
    if (quadrant === "nw") { azimuth = 360 - azimuth; }
    logall({azimuth});

    azimuth = (azimuth == 360) ? 0 : azimuth; 
    logall({azimuth});
    azimuth = rounddown(azimuth);
    logall({azimuth});
    return azimuth;
}

// bearings.set("n 0 w", 360);
// bearings.set("n 90 w", 270);
function AzimuthtoBearing (azimuth) {
    azimuth = parseFloat(azimuth);
    let degrees = azimuth; 
    let [primary, secondary] = ["n", "e"];
    if (azimuth > 90 && azimuth <= 180) { degrees = 180 - azimuth; [primary, secondary] = ["s", "e"]; }
    if (azimuth > 180 && azimuth <= 270) { degrees = azimuth - 180; [primary, secondary] = ["s", "w"]; }
    if (azimuth > 270 && azimuth <= 360) { degrees = 360 - azimuth; [primary, secondary] = ["n", "w"]; }
    degrees = decstodegs(degrees);
    return [primary, degrees, secondary].join(" ");
}

function GetBackAngle(angle) {
    angle = parseFloat(angle);
    angle = (angle < 180) ? angle + 180 : angle - 180;
    return rounddown(angle); 
}

function GetBackBearing (bearing) {
    let [primary, angle, secondary] = splitwords(bearing);
    let invprimary= (primary == "s") ? "n" : "s";
    let invsecondary = (secondary == "w") ? "e" : "w";
    return [invprimary, angle, invsecondary].join(" ");
}

function GetAllBearingInfo(bearing, magdecl, rotate=0, line={}) {
    magdecl = parseFloat(magdecl);
    rotate = parseFloat(rotate); 
    let [primary, anglespec, secondary] = splitwords(bearing);
    let tempangle =  normalizedegrees(parseFloat(anglespec));
    
    logall({bearing});
    logall({primary},{anglespec},{secondary});

    let quad = primary + secondary;
    if (quad == "az") { 
        line.az = normalizedegrees(tempangle + magdecl);
    } else { 
        line.az = rounddown(normalizedegrees(BearingtoAzimuth(bearing) + magdecl)); 
    }
    line.bearing = AzimuthtoBearing(line.az); 
    //line.lineangle = rounddown(normalizedegrees(AzimuthtoSVG(line.az + parseFloat(rotate))));
    line.lineangle = rounddown(normalizedegrees(AzimuthtoSVG(line.az + rotate)));
    
    console.log("lineangle: %s", line.lineangle);

    line.baz = GetBackAngle(line.az);
    line.bbearing = GetBackBearing(line.bearing);
    line.blineangle = GetBackAngle(line.lineangle);
    return line;
}

function GetBearingsFromPoints (x1, y1, x2, y2) {
    x1 = parseFloat(x1);
    y1 = parseFloat(y1);
    x2 = parseFloat(x2);
    y2 = parseFloat(y2);

    let [primary, secondary] = ["n", "e"]; 
    if (x2 < x1) { secondary = "w"; }
    if (y2 < y1) { primary= "s"; }
    let lineangle = GetAngleFromPoints(x1, y1, x2, y2);
    lineangle = rounddown(lineangle);
    let az = SVGtoAzimuth(lineangle);
    let degangle = decstodegs(az);
    return [primary, degangle, secondary].join(" ");
}

function chainstolinks (chains) { return parseFloat(chains) * 100; }
function linkstochains (links) { return parseFloat(links) / 100; }

// properly handle fractional values
function normalizechains (chainsValue) {
    chainsValue = parseFloat(chainsValue);
    const chains = Math.floor(chainsValue);
    const links = chainstolinks(chainsValue - chains);
    console.log("normalizechains  chainsvalue: %s, chains: %s, links: %s", chainsValue, chains, links);
    return [chains, links];
}

// properly handle values > 100 
function normalizelinks (linksvalue) {
    console.log("linksvalue coming in: %s", linksvalue);
    //const chains = Math.floor(linkstochains(parseFloat(linksvalue))); 
    linksvalue = parseFloat(linksvalue)
    const links = linksvalue % 100;
    const chains = linkstochains(linksvalue - links); 
    console.log("normalizelinks linksvalue: %s, chains: %s, links: %s", linksvalue, chains, links);
    return [chains, links];
}

// normchainslinksmap.set([4.83,107], [5,90]);
function normalizechainsandlinks (chainsValue, linksvalue) {
    return normalizelinks(parseFloat(linksvalue) + chainstolinks(parseFloat(chainsValue)));
}

function linkstofeet (links) { return (parseFloat(links) * 7.92) / 12; }
function feettolinks (feet) { return (parseFloat(feet) * 12) / 7.92; }
function tofeet (chains, links) { return linkstofeet(parseFloat(links) + chainstolinks(parseFloat(chains))); }
function fromfeet (feet) { return normalizelinks(feettolinks(feet)); }

function GetAllDistanceInfo (distances, line={}) {
    line.linelength = 0; 
    let distparts = splitwords(distances);
    if (distparts.length == 1) { distparts.push("feet"); } 
    for (let d=0; d < distparts.length; d+=2) {
        let [dist, unit] = [distparts[d], distparts[d+1]]; 
        logall({dist},{unit});
        dist = parseFloat(dist); 
        if (unit == "chains" || unit == "chain") {
            line.linelength += linkstofeet(chainstolinks(dist));
        } else if (unit == "links" || unit == "link") {
            line.linelength += linkstofeet(dist);
        } else if (unit == "feet" || unit == "foot") {
            line.linelength += dist;
        }
    }
    line.feet = line.linelength 
    let [tempchains, templinks] = fromfeet(line.feet);
    line.chains = tempchains;
    line.links = templinks;
    return line; 
}

function GetFeetOnly (distances) {
    let line = GetAllDistanceInfo(distances, {});
    return line.feet;
}

function GetDistanceFromPoints (x1, y1, x2, y2) {
    x1 = parseFloat(x1);
    y1 = parseFloat(y1);
    x2 = parseFloat(x2);
    y2 = parseFloat(y2);
    const xdiff = x2 - x1;
    const ydiff = y2 - y1;
    return rounddown(Math.sqrt( (xdiff ** 2) + (ydiff ** 2 ) ));
}

function GetDistanceOfLine (line) {
    let x1 = line.points[0].x;
    let y1 = line.points[0].y;
    let x2 = line.points[1].x;
    let y2 = line.points[1].y;
    return GetDistanceFromPoints(x1,y1,x2,y2);
}

function GetAngleFromPoints (x1, y1, x2, y2) {
    x1 = parseFloat(x1);
    y1 = parseFloat(y1);
    x2 = parseFloat(x2);
    y2 = parseFloat(y2);
    const xdiff = x2 - x1;
    const ydiff = y2 - y1; 
    const degrees = rounddown(Math.atan2(ydiff, xdiff) * ( 180 / Math.PI ));
    return rounddown(normalizedegrees(degrees));
}

function GetAngleOfLine (line) {
    let x1 = line.points[0].x;
    let y1 = line.points[0].y;
    let x2 = line.points[1].x;
    let y2 = line.points[1].y;
    return GetAngleFromPoints(x1,y1,x2,y2);
}

function GetEndPoint (x1, y1, angle, dist) {
    x1 = parseFloat(x1);
    y1 = parseFloat(y1);
    angle = parseFloat(angle);
    dist = parseFloat(dist);
    logall({x1},{y1},{angle},{dist});
    let x2 = x1 + Math.cos(degstorads(angle)) * dist;
    let y2 = y1 + Math.sin(degstorads(angle)) * dist;
    logall({x2},{y2});
    return {x: rounddown(x2), y: rounddown(y2)};
}

function GetIntersectionPoint(line1, line2) {  
    // Define line endpoints
    const line1start = { x: parseFloat(line1.points[0].x), y: parseFloat(line1.points[0].y) };
    const line1end = { x: parseFloat(line1.points[1].x), y: parseFloat(line1.points[1].y) };

    const line2start = { x: parseFloat(line2.points[0].x), y: parseFloat(line2.points[0].y) };
    const line2end = { x: parseFloat(line2.points[1].x), y: parseFloat(line2.points[1].y) };

    // Calculate direction vectors
    const line1dir = { x: line1end.x - line1start.x, y: line1end.y - line1start.y };
    const line2dir = { x: line2end.x - line2start.x, y: line2end.y - line2start.y };

    // Calculate denominator for intersection formula
    const denominator = line1dir.x * line2dir.y - line1dir.y * line2dir.x;
    let [intersectionx, intersectiony] = [null, null];
    if (denominator === 0) {
      console.log("Lines are parallel, no intersection");
    } else {
      // Calculate parameters for intersection formula
      const t1 = ((line2start.x - line1start.x) * line2dir.y - (line2start.y - line1start.y) * line2dir.x) / denominator;
      const t2 = ((line1start.x - line2start.x) * line1dir.y - (line1start.y - line2start.y) * line1dir.x) / -denominator;

      if (t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1) {
        // Calculate point of intersection
        intersectionx = line1start.x + t1 * line1dir.x;
        intersectiony = line1start.y + t1 * line1dir.y;
        console.log("Lines intersect at:", intersectionx, intersectiony);
      } else {
        console.log("Lines do not intersect");
      }
    }
    return { x: rounddown(intersectionx), y: rounddown(intersectiony) };
}

function AreLinesParallel(line1, line2) {  
    // Define line endpoints
    const line1start = { x: line1.points[0].x, y: line1.points[0].y };
    const line1end = { x: line1.points[1].x, y: line1.points[1].y };

    const line2start = { x: line2.points[0].x, y: line2.points[0].y };
    const line2end = { x: line2.points[1].x, y: line2.points[1].y };

    // Calculate direction vectors
    const line1dir = { x: line1end.x - line1start.x, y: line1end.y - line1start.y };
    const line2dir = { x: line2end.x - line2start.x, y: line2end.y - line2start.y };

    // Calculate denominator for intersection formula
    let areParallel = false;
    const denominator = line1dir.x * line2dir.y - line1dir.y * line2dir.x;
    if (denominator === 0) {
        areParallel = true; 
    }
    return areParallel;
}

function AreAnglesRight(angle1, angle2, tolerance=0.5) {
    angle1 = parseFloat(angle1);
    angle2 = parseFloat(angle2);;
    let rightangle = false;
    
    // normalize the bearings to account for wrapping, such as a 90 degree turn from 0 degrees to 270 degrees
    angle1 = (angle1 + 360) % 360;
    angle2 = (angle2 + 360) % 360;

    let anglediff = Math.abs(angle1 - angle2); 
    if (anglediff > 180) { anglediff = 360 - anglediff; }

    if (Math.abs(anglediff - 90) <= tolerance) { rightangle = true; }
    return rightangle;
}

function AreLinesRight(line1, line2, tolerance=0.5) {
    let angle1 = GetAngleOfLine(line1);
    let angle2 = GetAngleOfLine(line2);
    return AreAnglesRight(angle1, angle2, tolerance);
}

function GetInsideAverageAngle(angle1, angle2) {
    console.log("averaging: %s, %s", angle1, angle2);
    angle1 = parseFloat(angle1);
    angle2 = parseFloat(angle2);
    // Calculate the average of the two angles in degrees
    let averageAngle = (angle1 + angle2) / 2;

    // Adjust the average angle to be within the range of the short arc
    if (Math.abs(angle2 - angle1) > 180) {
        if (angle1 < angle2) {
            averageAngle += 180;
        } else {
            averageAngle -= 180;
        }
    }
    return rounddown(normalizedegrees(averageAngle));
}

function GetFuzzyLabelOffset (angle1, angle2, space) {
    logall({angle1});
    angle1 = GetBackAngle(angle1);
    let point = { x: space, y: space };
    let inaveangle = GetInsideAverageAngle(angle1, angle2);
    let outaveangle = (inaveangle + 180) % 360;
    logall({angle1},{angle2});
    logall({inaveangle},{outaveangle});
    if (outaveangle > 90 && outaveangle < 270) { point.x = -space; console.log("1"); }
    if (outaveangle == 90 || outaveangle == 270) { point.x = 0;  console.log("2");}
	if (outaveangle > 0 && outaveangle < 180) { console.log("Y"); point.y = -space; console.log("3");}
    if (outaveangle == 0 || outaveangle == 180) { point.y = 0;  console.log("4");}
    return point;
} 

function DoesLineContinueGivenPoints (intersectionpoint, knownendpoint, oppendpoint) {
    intersectionpoint.x = parseFloat(intersectionpoint.x);
    intersectionpoint.y = parseFloat(intersectionpoint.y);
    const vectorknown = {
        x: parseFloat(knownendpoint.x) - intersectionpoint.x,
        y: parseFloat(knownendpoint.y) - intersectionpoint.y,
    };

    const vectoropp = {
        x: parseFloat(oppendpoint.x) - intersectionpoint.x,
        y: parseFloat(oppendpoint.y) - intersectionpoint.y,
    };

    const dotProduct = vectorknown.x * vectoropp.x + vectorknown.y * vectoropp.y;

    return dotProduct < 0;
}

function DoesLineContinue (line, intersectionpoint) {
    let knownendpoint = line.points[1];
    let oppendpoint= line.points[0];
    return DoesLineContinueGivenPoints(intersectionpoint, knownendpoint, oppendpoint);
}
   
function IsPointOnLine (x, y, line, tolerance=0.5) {
    logall({x},{y});
    x = parseFloat(x); y = parseFloat(y);
    let [x1,y1] = [parseFloat(line.points[0].x), parseFloat(line.points[0].y)];
    logall({x1},{y1});
    let [x2,y2] = [parseFloat(line.points[1].x), parseFloat(line.points[1].y)];
    logall({x2},{y2});

    const area = Math.abs(0.5 * ((x1 - x2) * (y - y2) - (x - x2) * (y1 - y2)));
    const segmentLength = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

    // logall({area},{segmentLength});
    return area < tolerance && segmentLength >= Math.sqrt((x - x1) ** 2 + (y - y1) ** 2) && segmentLength >= Math.sqrt((x - x2) ** 2 + (y - y2) ** 2);
}

function GetRightAnglePoints(line1, line2, intersectionpoint, space) {
    // Array to store all arrays of points for right angles
    const allRightAnglePoints = [];

    let  [intx, inty] = [parseFloat(intersectionpoint.x), parseFloat(intersectionpoint.y)];
    logall({intx},{inty}); 
    let hypot = Math.sqrt((space ** 2) + (space ** 2)); 

    let angle1 = GetAngleOfLine(line1);
    let angle2 = GetAngleOfLine(line2);
    logall({angle1},{angle2}); 

    if (AreAnglesRight(angle1, angle2)) {
        console.log("  -- YES, right angles");

        // make sure we haven't gone past length of line
        let linepoint1 = GetEndPoint(intx, inty, angle1, space);
        let islinepoint1on = IsPointOnLine(linepoint1.x, linepoint1.y, line1);
        if (! islinepoint1on) { 
            console.log("first try on first line failed");
            angle1 = GetBackAngle(angle1); 
            linepoint1 = GetEndPoint(intx, inty, angle1 , space); 
            islinepoint1on = IsPointOnLine(linepoint1.x, linepoint1.y, line1);
            if (! islinepoint1on) { console.log("second try failed"); }
        } else { console.log("point (first) IS ON line"); }

        let linepoint2 = GetEndPoint(intx, inty, angle2, space);
        let islinepoint2on = IsPointOnLine(linepoint2.x, linepoint2.y, line2);
        if (! islinepoint2on) { 
            console.log("first try on second line failed");
            angle2 = GetBackAngle(angle2);
            linepoint2 = GetEndPoint(intx, inty, angle2, space); 
            islinepoint2on = IsPointOnLine(linepoint2.x, linepoint2.y, line2);
            if (! islinepoint2on) { console.log("second try failed"); }
        }

        if (islinepoint1on && islinepoint2on) {
            let aveangle1 = GetInsideAverageAngle(angle1, angle2)
            let avepoint1 = GetEndPoint(intx, inty, aveangle1, hypot);
            allRightAnglePoints.push([avepoint1, linepoint1, linepoint2]);
        } else { console.log("points SHOULD BE but are NOT"); }

        let [angle3, angle4] = [null, null];
        let [linepoint3, linepoint4] = [null, null];
        let [line1cont, line2cont] = [null, null];
        let [islinepoint3on, islinepoint4on] = [null, null];

        line1cont = DoesLineContinue(line1, {x:intx, y:inty});
        if (line1cont) {
            angle3 = GetBackAngle(angle1);
            linepoint3 = GetEndPoint(intx, inty, angle3, space);
            islinepoint3on = IsPointOnLine(linepoint3.x, linepoint3.y, line1);
          
            if (islinepoint3on) {
                let aveangle2 = GetInsideAverageAngle(angle2, angle3);
                let avepoint2 = GetEndPoint(intx, inty, aveangle2, hypot);
                allRightAnglePoints.push([avepoint2, linepoint2, linepoint3]);
            }
        }
        
        line2cont = DoesLineContinue(line2, {x:intx, y:inty});
        if (line2cont) {
            angle4 = GetBackAngle(angle2);
            linepoint4 = GetEndPoint(intx, inty, angle4, space);
            islinepoint4on = IsPointOnLine(linepoint4.x, linepoint4.y, line2);
          
            if (islinepoint4on) {
                let aveangle4 = GetInsideAverageAngle(angle1, angle4);
                let avepoint4 = GetEndPoint(intx, inty, aveangle4, hypot);
                allRightAnglePoints.push([avepoint4, linepoint1, linepoint4]);
            }
        }

        if (line1cont && line2cont) {
           if (islinepoint3on && islinepoint4on) {
                let aveangle3 = GetInsideAverageAngle(angle3, angle4);
                let avepoint3 = GetEndPoint(intx, inty, aveangle3, hypot);
                allRightAnglePoints.push([avepoint3, linepoint3, linepoint4]);
           } 
        }
    }
    console.log("What do I have: %j", allRightAnglePoints);
    return allRightAnglePoints;
}

function MoveAndRotatePoint(x, y, xoffset=0, yoffset=0, rotatedegrees=0) {

    let [rotx, roty] = [x,y];
    if (rotatedegrees) {
        let rotateradians = degstorads(rotatedegrees);
        const cos = Math.cos(rotateradians);
        const sin = Math.sin(rotateradians); 
        rotx = (x * cos) - (y * sin);
        roty = (x * sin) + (y * cos); 
        let adjpoint = CartCoordstoSVGCoords({x:rotx, y:roty});
        rotx= adjpoint.x;
        roty = adjpoint.y;
    }

    x = rotx + xoffset;
    y = roty + yoffset;

    // normalize any -0 values
    if (Math.abs(x) === 0) { x = 0; }
    if (Math.abs(y) === 0) { y = 0; }

    return { x: rounddown(x), y: rounddown(y)};
}

function RotateBoundingBox(bbox, angledegs) {
    // Convert the angle from degrees to radians
    let relanglerads = degstorads(angledegs);
    const cos = Math.cos(relanglerads);
    const sin = Math.sin(relanglerads);

    // Define the coordinates of the corners of the bounding box
    const corners = [
        { x: bbox.minx, y: bbox.miny },
        { x: bbox.maxx, y: bbox.miny },
        { x: bbox.minx, y: bbox.maxy },
        { x: bbox.maxx, y: bbox.maxy },
    ];

    // Rotate each corner around the center of the bounding box and keep track of the new coordinates
    const centerX = (bbox.minx + bbox.maxx) / 2;
    const centerY = (bbox.miny + bbox.maxy) / 2;

    const rotatedCorners = corners.map(({ x, y }) => ({
      x: centerX + (x - centerX) * cos - (y - centerY) * sin,
      y: centerY + (x - centerX) * sin + (y - centerY) * cos,
    }));

    // Calculate the new bounding box
    bbox.minx = rounddown(Math.min(...rotatedCorners.map((corner) => corner.x)));
    bbox.miny = rounddown(Math.min(...rotatedCorners.map((corner) => corner.y)));
    bbox.maxx = rounddown(Math.max(...rotatedCorners.map((corner) => corner.x)));
    bbox.maxy = rounddown(Math.max(...rotatedCorners.map((corner) => corner.y)));

    return bbox;
}

module.exports = { 
    numberletter, splitwords, logall, 
    rounddown, normalizedegrees,
    degstorads, radstodegs, 
    chainstolinks, linkstochains,
    normalizechains, normalizelinks, normalizechainsandlinks,
    tofeet, fromfeet, 
    degstodecs, decstodegs,  
    GetEndPoint, GetDistanceFromPoints, GetAngleFromPoints, 
    MoveAndRotatePoint,
    GetIntersectionPoint, AreLinesParallel,
    GetDistanceOfLine, GetAngleOfLine, IsPointOnLine,
    AreAnglesRight, AreLinesRight, GetRightAnglePoints, GetInsideAverageAngle,
    DoesLineContinue, DoesLineContinueGivenPoints,
    GetFuzzyLabelOffset, BearingtoAzimuth, AzimuthtoBearing, AzimuthtoSVG, SVGtoAzimuth,
    CartCoordstoSVGCoords, RotateBoundingBox,
    GetBackAngle, GetBackBearing, GetBearingsFromPoints, 
    GetAllDistanceInfo, GetFeetOnly, GetAllBearingInfo, 
}


// In SVG, positive angles are measured clockwise from the positive x-axis, and the SVG coordinate system starts with 0 degrees at the positive x-axis and increases clockwise. Therefore, SVG 90 degrees corresponds to azimuth 0 degrees, and SVG 0 degrees corresponds to azimuth 90 degrees. This is because SVG's coordinate system is often used in a screen or graphical context, where the orientation and angle direction may differ from standard mathematical conventions.
