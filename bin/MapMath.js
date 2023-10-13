const CITESTR = "—";
const CHAINS = ["chains", "chain", "ch", "c"];
const LINKS = ["links", "link", "lk", "l"];
const FEET = ["feet", "foot", "ft", "f"];

function splitwords (line, spliton=" ", size=1) { 
    line = line.toString();
    const items = line.split(spliton);
    if (size === 1) { return items };
    const result = [];
    for (let i = 0; i < items.length; i += size) {
        result.push(items.slice(i, i + size));
    }
    return result;
}

function titlecase(word) {
  // Convert the word to lowercase and then capitalize the first letter
  return word.toLowerCase().charAt(0).toUpperCase() + word.slice(1);
}

const DEGSTR = "°";
function containsOnlyLetters(string) { return /^[a-zA-Z]+$/.test(string); }
function formatDMS(dms) {
    let finalDMSparts = []; 
    let dmswords = splitwords(dms.toString()); 
    for (let w=0; w < dmswords.length; w++) {
        let word = dmswords[w];
        if (word.includes(",")) {
            let dmsparts = splitwords(word, ","); 
            let tempDMS = "";
            if (dmsparts.length > 0) { tempDMS += `${dmsparts[0]}${DEGSTR}`; }
            if (dmsparts.length > 1) { tempDMS += ` ${dmsparts[1]}\'`; }
            if (dmsparts.length > 2) { tempDMS += ` ${dmsparts[2]}\"`; }
            finalDMSparts.push(tempDMS);
        } else if (containsOnlyLetters(dmswords[w])) {
            finalDMSparts.push(dmswords[w].toUpperCase());
        } 
    }
    return finalDMSparts.join(" ");
}

//function numberletter (num) { return String.fromCharCode(96 + parseInt(num)); }
function numberletter(index) {
    if (index <= 0) { return ''; }

    const base = 26;
    const charCodeA = 'A'.charCodeAt(0) - 1;
    const remainder = index % base;
    let quotient = Math.floor(index / base);
    let label = '';

    if (remainder === 0) { label = 'Z'; quotient--; } 
    else { label = String.fromCharCode(charCodeA + remainder); }

    return numberletter(quotient) + label;
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
}

function createMapFromArray(objectarray, id="id", copyobj=false) {
    const objectmap= new Map();
    for (let o=0; o < objectarray.length; o++) {
       if (objectarray[o] && objectarray[o][id]) {
            let object = objectarray[o];
            if (copyobj) {
                objectmap.set(object[id], JSON.parse(JSON.stringify(object)));
            } else {
                objectmap.set(object[id], object);
            }
        } 
    }
    return objectmap;
}
 
function cascadeProperties (objects, defaults={}) {
    // Create a map for quick lookup based on id
    const objectMap = new Map();
    for (let x=0; x < objects.length; x++) {
        if (objects[x] && objects[x].id) {
            objectMap.set(objects[x].id, objects[x]);
        }
    }

    function mergeobjects(parent, child) {
        // Cascade properties from parent to child
        for (const key in parent) {
            if (child && !(key in child)) {
                let defaultvalue =  JSON.parse(JSON.stringify(parent[key])); // ensure we have a copy of the value and not a reference to a previous value
                child[key] = defaultvalue; 
            } else {
                if (key == "instructions" || key == "notes") {
                    if (! Array.isArray(child[key])) {
                        let tempvalue = child[key]
                        child[key] = [];
                        child[key].push(tempvalue);
                    }
                    child[key] = parent[key].concat(child[key]); 
                }
            } 
        }
        return child;
    }

    // Recursive function to cascade properties
    function cascadePropertiesRecursive(obj) {
        console.log('cascading properties', obj);
        if (obj && obj.parentid) {
            const parent = objectMap.get(obj.parentid);
            if (parent) {
                // Recursively update properties from the parent
                cascadePropertiesRecursive(parent);
                obj = mergeobjects(parent, obj);
            }
        } else {
            obj = mergeobjects(defaults, obj);
        }
        return obj;
    }

    let mergedobjects = []; 
    // Apply cascading properties to each object
    for (let i=0; i < objects.length; i++) {
        mergedobjects.push(cascadePropertiesRecursive(objects[i])) ;
    }
    return mergedobjects;
}

// round down to two decimal places, likely in preparation for display
function rounddown (value) { return (value) ? parseFloat(value.toFixed(2)) : value ;} 
function normalizedegrees(degrees) { return (parseFloat(degrees) % 360 + 360) % 360; }

function GetBackAngle(angle) {
    angle = parseFloat(angle);
    angle = (angle < 180) ? angle + 180 : angle - 180;
    return rounddown(angle); 
}

function AzimuthtoSVG (azimuth) { return normalizedegrees(90 - normalizedegrees(azimuth)); }
function SVGtoAzimuth (svgangle) { return normalizedegrees(90 - normalizedegrees(svgangle)); }
function CartCoordstoSVGCoords(point) {
    let {x,y} = point;
    if (y) { y = -y; }
    return {x,y};
}
// for the same of clarity
function SVGCoordstoCartCoords(point) {
    //if (point.y) { point.y = -point.y; }
    //return point;
    let {x,y} = point;
    if (y) { y = -y; }
    return {x,y};
}

function squareFeetToAcres(squareFeet) { return rounddown(squareFeet / 43560) ; }

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
    let minutes = Math.floor(minutesDecimal);
    const secondsDecimal = (minutesDecimal - minutes) * 60;
    let seconds = Math.round(secondsDecimal);
    
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
    let [primary, angle, secondary] = splitwords(bearing);
    let quadrant = primary + secondary;
    let azimuth = degstodecs(angle);

    if (quadrant === "se") { azimuth = 180 - azimuth} 
    if (quadrant === "sw") { azimuth = 180 + azimuth; } 
    if (quadrant === "nw") { azimuth = 360 - azimuth; }

    azimuth = (azimuth == 360) ? 0 : azimuth; 
    azimuth = rounddown(azimuth);
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

function GetBackBearing (bearing) {
    let [primary, angle, secondary] = splitwords(bearing);
    let invprimary= (primary == "s") ? "n" : "s";
    let invsecondary = (secondary == "w") ? "e" : "w";
    return [invprimary, angle, invsecondary].join(" ");
}


// function AzimuthtoSVG (azimuth) { return normalizedegrees(90 - azimuth); }
function GetAllBearingInfo(bearing, magdecl=0, rotate=0, line={}) {
    magdecl = parseFloat(magdecl);
    rotate = parseFloat(rotate); 
    let [primary, anglespec, secondary] = splitwords(bearing);
    let tempangle =  parseFloat(anglespec);
    let quad = primary + secondary;
    console.log("tempangle: %s, bearing: %s, quad: %s", tempangle, bearing, quad);
    if (quad == "tn") { 
        line.az = rounddown(normalizedegrees(tempangle));
    } else if (quad == "az") { 
        let adjustedangle = tempangle + magdecl;
        line.az = rounddown(normalizedegrees(adjustedangle));
    } else { 
        line.az = rounddown(normalizedegrees(BearingtoAzimuth(bearing) + magdecl)); 
    }
    line.bearing = AzimuthtoBearing(line.az); 
    console.log("line.az: %s, rotate: %s", line.az, rotate);
console.log("normalized az: %s", normalizedegrees(line.az));
console.log("90 - az: %s", 90 - line.az);
console.log("normalized 90 - az: %s", normalizedegrees(90 - line.az));
//function AzimuthtoSVG (azimuth) { return normalizedegrees(90 - normalizedegrees(azimuth)); }
    console.log("az to svg: %s", AzimuthtoSVG(line.az + rotate));
    console.log("normalized: %s", normalizedegrees(AzimuthtoSVG(line.az + rotate)));
    console.log("rounded: %s", rounddown(normalizedegrees(AzimuthtoSVG(line.az + rotate))));

    line.lineangle = AzimuthtoSVG(line.az + rotate);
    console.log(" !!!!! line.az: %s, line.bearing: %s, line.lineangle: %s", line.az, line.bearing, line.lineangle); 

    let newbearing = line.bearing; let newaz = line.az; let newlineangle = line.lineangle;
    line.baz = GetBackAngle(line.az);
    line.bbearing = GetBackBearing(line.bearing);
    line.blineangle = GetBackAngle(line.lineangle);
    return line;
}

function GetAzimuthFromPoints(x1, y1, x2, y2) {
    return az = rounddown(SVGtoAzimuth(GetAngleFromPoints(x1, y1, x2, y2)));
}

function GetBearingsFromPoints (x1, y1, x2, y2) {
    // remember to use Cartesian points (negate y axis) for calcs
    x1 = parseFloat(x1);
    y1 = -parseFloat(y1);
    x2 = parseFloat(x2);
    y2 = -parseFloat(y2);

    let az = GetAzimuthFromPoints(x1, y1, x2, y2);
    return AzimuthtoBearing(az);
}

function chainstolinks (chains) { return parseFloat(chains) * 100; }
function linkstochains (links) { return parseFloat(links) / 100; }

// properly handle fractional values
function normalizechains (chainsValue) {
    chainsValue = parseFloat(chainsValue);
    const chains = Math.floor(chainsValue);
    const links = chainstolinks(chainsValue - chains);
    return [chains, links];
}

// properly handle values > 100 
function normalizelinks (linksvalue) {
    //const chains = Math.floor(linkstochains(parseFloat(linksvalue))); 
    linksvalue = parseFloat(linksvalue)
    const links = linksvalue % 100;
    const chains = linkstochains(linksvalue - links); 
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
        dist = parseFloat(dist); 
        if (CHAINS.includes(unit)) {
            line.linelength += linkstofeet(chainstolinks(dist));
        } else if (LINKS.includes(unit)) {
            line.linelength += linkstofeet(dist);
        } else if (FEET.includes(unit)) {
            line.linelength += dist;
        }
    }
    line.linelength = rounddown(line.linelength);
    line.feet = line.linelength 
    let [tempchains, templinks] = fromfeet(line.feet);
    line.chains = tempchains;
    line.links = rounddown(templinks);
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
    const xdiff = x1 - x2;
    const ydiff = y1 - y2;
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
    const degrees = rounddown(radstodegs(Math.atan2(ydiff, xdiff)));
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
    let x2 = x1 + Math.cos(degstorads(angle)) * dist;
    let y2 = y1 + Math.sin(degstorads(angle)) * dist;
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
    } else {
      // Calculate parameters for intersection formula
      const t1 = ((line2start.x - line1start.x) * line2dir.y - (line2start.y - line1start.y) * line2dir.x) / denominator;
      const t2 = ((line1start.x - line2start.x) * line1dir.y - (line1start.y - line2start.y) * line1dir.x) / -denominator;

      if (t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1) {
        // Calculate point of intersection
        intersectionx = line1start.x + t1 * line1dir.x;
        intersectiony = line1start.y + t1 * line1dir.y;
      } else {
        // console.log("Lines do not intersect");
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
    angle2 = parseFloat(angle2);
    let isrightangle = false;
    
    // normalize the bearings to account for wrapping, such as a 90 degree turn from 0 degrees to 270 degrees
    angle1 = (angle1 + 360) % 360;
    angle2 = (angle2 + 360) % 360;

    // Calculate the absolute difference between the two angles
    let anglediff = Math.abs(angle1 - angle2); 
    if (anglediff > 180) { anglediff = 360 - anglediff; }

    if (Math.abs(anglediff - 90) <= tolerance) { isrightangle = true; }
    return isrightangle;
}

function AreLinesRight(line1, line2, tolerance=0.5) {
    let angle1 = GetAngleOfLine(line1);
    let angle2 = GetAngleOfLine(line2);
    return AreAnglesRight(angle1, angle2, tolerance);
}

function GetInsideAverageAngle(angle1, angle2) {
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
    space = parseFloat(space);
    let tempangle1 = angle1;
    angle1 = GetBackAngle(angle1);
    let point = { x: space, y: space };
    let inaveangle = GetInsideAverageAngle(angle1, angle2);
    let outaveangle = (inaveangle + 180) % 360;
    if (outaveangle > 90 && outaveangle < 270) { point.x = -space; }
    if (outaveangle == 90 || outaveangle == 270) { point.x = 0; }
	if (outaveangle > 0 && outaveangle < 180) { point.y = -space; }
    if (outaveangle == 0 || outaveangle == 180) { point.y = 0; }
    return point;
} 

function GetRatioOfLineLengths (line1, line2) {
    console.log("line1: %o, line2: %o", line1, line2);
    let length1 = GetDistanceOfLine(line1);
    let length2 = GetDistanceOfLine(line2);
    console.log("length1: %s, length2: %s", length1, length2);
    return length2 / length1; 
}

function GetRatioOfLineLengthsGivenPoints (point1, point2, point3, point4) {
    let line1 = {}; line1.points = [point1, point2];
    let line2 = {}; line2.points = [point3, point4];
    return GetRatioOfLineLengths(line1, line2);
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
   
function IsPointOnLine (x, y, line, tolerance=1) {
    x = parseFloat(x); y = parseFloat(y);
    let [x1,y1] = [parseFloat(line.points[0].x), parseFloat(line.points[0].y)];
    let [x2,y2] = [parseFloat(line.points[1].x), parseFloat(line.points[1].y)];

    const area = Math.abs(0.5 * ((x1 - x2) * (y - y2) - (x - x2) * (y1 - y2)));
    const segmentLength = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

    return area < tolerance && segmentLength >= Math.sqrt((x - x1) ** 2 + (y - y1) ** 2) && segmentLength >= Math.sqrt((x - x2) ** 2 + (y - y2) ** 2);
}

function GetRightAnglePoints(line1, line2, intersectionpoint, space) {
    // Array to store all arrays of points for right angles
    const allRightAnglePoints = [];

    let  [intx, inty] = [parseFloat(intersectionpoint.x), parseFloat(intersectionpoint.y)];
    let hypot = Math.sqrt((space ** 2) + (space ** 2)); 
    let angle1 = GetAngleOfLine(line1);
    let angle2 = GetAngleOfLine(line2);

    // check forward and back angles
    let isrightangle = AreAnglesRight(angle1, angle2);

    if (isrightangle) {
        // make sure we haven't gone past length of line
        let linepoint1 = GetEndPoint(intx, inty, angle1, space);
        let islinepoint1on = IsPointOnLine(linepoint1.x, linepoint1.y, line1);
        if (! islinepoint1on) { 
            angle1 = GetBackAngle(angle1); 
            linepoint1 = GetEndPoint(intx, inty, angle1 , space); 
            islinepoint1on = IsPointOnLine(linepoint1.x, linepoint1.y, line1);
        }

        let linepoint2 = GetEndPoint(intx, inty, angle2, space);
        let islinepoint2on = IsPointOnLine(linepoint2.x, linepoint2.y, line2);
        if (! islinepoint2on) { 
            angle2 = GetBackAngle(angle2);
            linepoint2 = GetEndPoint(intx, inty, angle2, space); 
            islinepoint2on = IsPointOnLine(linepoint2.x, linepoint2.y, line2);
        }

        if (islinepoint1on && islinepoint2on) {
            let aveangle1 = GetInsideAverageAngle(angle1, angle2)
            let avepoint1 = GetEndPoint(intx, inty, aveangle1, hypot);
            allRightAnglePoints.push([avepoint1, linepoint1, linepoint2]);
        } 

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
    return allRightAnglePoints;
}

// this function, unlike most others, is meant to take SVG coordinates
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

    x = rotx + parseFloat(xoffset);
    y = roty + parseFloat(yoffset);

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
    const centerx = (bbox.minx + bbox.maxx) / 2;
    const centery = (bbox.miny + bbox.maxy) / 2;

    const rotatedCorners = corners.map(({ x, y }) => ({
      x: centerx + (x - centerx) * cos - (y - centery) * sin,
      y: centery + (x - centerx) * sin + (y - centery) * cos,
    }));

    // Calculate the new bounding box
    bbox.minx = rounddown(Math.min(...rotatedCorners.map((corner) => corner.x)));
    bbox.miny = rounddown(Math.min(...rotatedCorners.map((corner) => corner.y)));
    bbox.maxx = rounddown(Math.max(...rotatedCorners.map((corner) => corner.x)));
    bbox.maxy = rounddown(Math.max(...rotatedCorners.map((corner) => corner.y)));

    return bbox;
}


// get average of all endpoint coordinates for map steps
function getPolygonCartCenterPoint(lines) {
    let cartCenterPoint = {x:0, y:0};
    if (lines.length === 0) { return null; } // Handle an empty polygon or invalid input. 

    let [totalx, totaly] = [0, 0];
    for (let i=0; i < lines.length; i++) {
        totalx += lines[i].points[1].x;
        totaly += lines[i].points[1].y;
    }

    const centerx = rounddown(totalx / lines.length);
    const centery = rounddown(totaly / lines.length);
    cartCenterPoint = SVGCoordstoCartCoords({x: centerx, y: centery}); 
    return cartCenterPoint;
}

function isClosedPolygon(lines, tolerance=1) {
    let isClosedPolygon = true;
    if (lines.length < 3) {
        // A polygon must have at least 3 sides to be considered closed.
        isClosedPolygon = false;
        return isClosedPolygon;
    }

    for (let i = 0; i < lines.length; i++) {
        let currentEndPoint = lines[i].points[1];

        // if on last step, wrap to first *end*point
        let nextStartPoint = lines[0].points[1];
        if (i < lines.length - 1) {
            nextStartPoint = lines[i+1].points[0];
        } 

        if (currentEndPoint.x < nextStartPoint.x - tolerance || currentEndPoint.x > nextStartPoint.x + tolerance) {
            if (currentEndPoint.y < nextStartPoint.y - tolerance || currentEndPoint.y > nextStartPoint.y + tolerance) {
                // If any consecutive pair of points is not connected, within tolerance, it's not a closed polygon.
                isClosedPolygon = false;
                break;
            }
        }
    }
    return isClosedPolygon;
}


// Function to calculate the area of a polygon in square pixels (= square feet at scale 1).
function calculatePolygonArea(lines) {
    let area = 0;
    if (! isClosedPolygon(lines)) { return 0; }
    for (let i = 0; i < lines.length; i++) {
        const currentPoint = lines[i].points[1];
        const nextPoint = lines[(i + 1) % lines.length].points[1]; // Wrap around to the first point.
        area += (currentPoint.x * nextPoint.y - nextPoint.x * currentPoint.y);
    }
    return rounddown(Math.abs(area) / 2);
}


module.exports = { 
    CITESTR, DEGSTR, formatDMS, containsOnlyLetters, titlecase,
    numberletter, splitwords, logall, createMapFromArray, cascadeProperties,  
    rounddown, normalizedegrees,
    degstorads, radstodegs, 
    chainstolinks, linkstochains,
    normalizechains, normalizelinks, normalizechainsandlinks,
    tofeet, fromfeet, 
    degstodecs, decstodegs,  
    GetEndPoint, GetDistanceFromPoints, GetAngleFromPoints, 
    MoveAndRotatePoint, GetRatioOfLineLengthsGivenPoints, GetRatioOfLineLengths,
    GetIntersectionPoint, AreLinesParallel,
    GetDistanceOfLine, GetAngleOfLine, IsPointOnLine,
    AreAnglesRight, AreLinesRight, GetRightAnglePoints, GetInsideAverageAngle,
    DoesLineContinue, DoesLineContinueGivenPoints,
    GetFuzzyLabelOffset, BearingtoAzimuth, AzimuthtoBearing, AzimuthtoSVG, SVGtoAzimuth,
    CartCoordstoSVGCoords, SVGCoordstoCartCoords, RotateBoundingBox,
    GetBackAngle, GetBackBearing, GetBearingsFromPoints, 
    GetAllDistanceInfo, GetFeetOnly, GetAllBearingInfo, 
    squareFeetToAcres, isClosedPolygon, getPolygonCartCenterPoint, calculatePolygonArea
}


// In SVG, positive angles are measured clockwise from the positive x-axis, and the SVG coordinate system starts with 0 degrees at the positive x-axis and increases clockwise. Therefore, SVG 90 degrees corresponds to azimuth 0 degrees, and SVG 0 degrees corresponds to azimuth 90 degrees. This is because SVG's coordinate system is often used in a screen or graphical context, where the orientation and angle direction may differ from standard mathematical conventions.
