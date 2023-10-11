// Take all the elements of a rectangular matrix visit them (i.e. re-order them
// without adding or dropping any) as you please, hopefully finding a visit that is
// RLE-friendly i.e. that transitions colors (black/white) the least.
// You do that by applying a number of remaps.

// All of these routines apart from the first one (createIndices) take
// an existing visit of a matrix and produce a new visit of the same matrix.
//
// So how it works is that you start from the base visit which basically gives you the standard
// matrix coordinates of each element in the standard row-by-row order, then
// you apply a number of subsequent remaps to get modifications
// e.g.
//   createIndices -> rotate 90 degrees
//   createIndices -> flip horizontal
//   createIndices -> bustrophedic horizontal
// note that some sequences of remaps are equivalent
// e.g.
//   createIndices -> rotate 90 degrees -> rotate 90 degrees
// is equivalent to
//   createIndices -> flip horizontal -> flip vertical
// and
//   createIndices -> reverseRemap
// is equivalent to
//   createIndices -> flip horizontal -> flip vertical
//
// also note that some scans are just really hard to visualise
// mentally.
//
// NOTE 3: some remappings inherently create a 1D array of coordinates
// rather than having a 2D geometric sense, e.g. spiralInsideOutRemap
// and hilbert-visit. In these cases, the width and height of the
// resulting matrix are arbitrary and there is not much sense to
// do a further geometric visit to those e.g. 90 degrees rotation
// as the original 2D geometric sense is lost at that point.

// row scan of rectangle of size (width x height)
// returns an array with all the newCoordinates
function createIndices(width, height) {
    var coordinates = [];
    for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++)
            coordinates.push([x, y]);
    }
    return {width, height, coordinates};
}

// same as above but takes a canvas as input
function createIndicesFromCanvas(canvas) {
    return createIndices(canvas.width, canvas.height);
}


function testAssertions(sourceCoordinatesArray, newCoordinates) {
    // assert that the count of elements in sourceCoordinatesArray is the same as the count of elements in newCoordinates
    assert(sourceCoordinatesArray.length == newCoordinates.length);

    // assert that all the elements in sourceCoordinatesArray are in newCoordinates
    for (var i = 0; i < sourceCoordinatesArray.length; i++) {
        // note that we use the same exact elements of sourceCoordinatesArray
        // so we can use includes as the elements respond well to === as they are the _same_ elements
        assert(newCoordinates.includes(sourceCoordinatesArray[i]));
    }
    
    // assert that all the elements in newCoordinates as in sourceCoordinatesArray
    for (var i = 0; i < newCoordinates.length; i++) {
        // note that we use the same exact elements of sourceCoordinatesArray
        // so we can use includes as the elements respond well to === as they are the _same_ elements
        assert(sourceCoordinatesArray.includes(newCoordinates[i]));
    }
}

// diagonalStripesRemap means to visit the rectangle in diagonal stripes
// 
// diagonalStripesRemap i.e. start from top left corner and go up to the top right diagonally until the column is within the column range of the rectangle
// then move down one row and repeat (until you reach row max(width, height) - 1).
// Note that with this simple system we cover many pixels that are outside the rectangle, we simply ignore them.
//
//  for each row j from 0 to (max(width, height) - 1):
//    // start from the leftmost column and go up right until the column is within the column range of the rectangle
//    for each column k from 0 to width - 1:
//      // accessing [j-k,k] here is what makes us go diagonally to the top right
//      if [j-k,k] is inside the rectangle (check both coordinates are >= 0 and < width and height)
//         add [j-k,k] to the diagonalStripesRemap array
//  then use the diagonalStripesRemap to find the corresponding element from the source sourceCoordinatesArray
function diagonalStripesRemap(width, height, sourceCoordinatesArray) {
    var diagonalStripesScan = [];
    var maxRow = Math.max(width, height) - 1;

    // for each row j from 0 to maxRow
    for (var j = 0; j <= maxRow; j++) {
        // for each column k from 0 to width - 1
        for (var k = 0; k < width; k++) {
            // if [j-k,k] is inside the rectangle (check both coordinates are >= 0 and < width and height)
            if ((j - k >= 0) && (j - k < height) && (k >= 0) && (k < width)) {
                // add [j-k,k] to the diagonalStripesScan array
                diagonalStripesScan.push([j - k, k]);
            }
        }
    }

    // now use the diagonalStripesScan to find the corresponding element from the source sourceCoordinatesArray
    // i.e. for each coordinate in diagonalStripesScan, find the corresponding coordinate in sourceCoordinatesArray
    var newCoordinates = [];
    for (var i = 0; i < diagonalStripesScan.length; i++) {
        var x = diagonalStripesScan[i][0];
        var y = diagonalStripesScan[i][1];
        newCoordinates.push(sourceCoordinatesArray[x + y * width]);
    }

    testAssertions(sourceCoordinatesArray, newCoordinates);

    return {width, height, newCoordinates};
}



// reverseRemap i.e. visit from bottom right corner to top left corner
function reverseRemap(width, height, sourceCoordinatesArray) {
    // note that there is no need to have a mapping step to the
    // sourceCoordinatesArray
    var newCoordinates = [];
    for (var i = sourceCoordinatesArray.length - 1; i >= 0; i--) {
        newCoordinates.push(sourceCoordinatesArray[i]);
    }

    testAssertions(sourceCoordinatesArray, newCoordinates);

    return {width, height, newCoordinates};
}



// spiral scan inside out of rectangle of size (width x height)
function spiralInsideOutRemap(width, height, sourceCoordinatesArray) {
    var spiralScan = [];
    var x = 0;
    var y = 0;
    var dx = 0;
    var dy = -1;
    var t = Math.max(width, height);
    var maxI = t * t;
    for (var i = 0; i < maxI; i++) {
        if ((-width / 2 <= x) && (x <= width / 2) && (-height / 2 <= y) && (y <= height / 2)) {
            spiralScan.push([x, y]);
        }
        if ((x == y) || ((x < 0) && (x == -y)) || ((x > 0) && (x == 1 - y))) {
            t = dx;
            dx = -dy;
            dy = t;
        }
        x += dx;
        y += dy;
    }
    // now use the spiralScan to find the corresponding element from the source sourceCoordinatesArray
    // i.e. for each coordinate in spiralScan, find the corresponding coordinate in sourceCoordinatesArray
    var newCoordinates = [];
    for (var i = 0; i < spiralScan.length; i++) {
        var x = spiralScan[i][0];
        var y = spiralScan[i][1];
        newCoordinates.push(sourceCoordinatesArray[x + y * width]);
    }

    testAssertions(sourceCoordinatesArray, newCoordinates);

    // note that size of the resulting matrix here doesn't make much sense
    // i.e. it's arbitrary
    return {width, height, newCoordinates};
}


// bustrophedic modification of a scan
// takes an array of coordinates and returns an array of new coordinates
// where the pixels in the even rows are visited from left to right
function bustrophedicHorizontalRemap(width, height, sourceCoordinatesArray) {
    // generate a bustrophedic scan of the standard width x height rectangle
    // and then map that into the sourceCoordinatesArray
    var bustrophedicScan = [];
    for (var y = 0; y < height; y++) {
        if (y % 2 == 0) {
            // even row
            for (var x = 0; x < width; x++)
                bustrophedicScan.push([x, y]);
        } else {
            // odd row
            for (var x = width - 1; x >= 0; x--)
                bustrophedicScan.push([x, y]);
        }
    }
    // now use the bustrophedicScan to find the corresponding element from the source sourceCoordinatesArray
    // i.e. for each coordinate in bustrophedicScan, find the corresponding coordinate in sourceCoordinatesArray
    var newCoordinates = [];
    for (var i = 0; i < bustrophedicScan.length; i++) {
        var x = bustrophedicScan[i][0];
        var y = bustrophedicScan[i][1];
        newCoordinates.push(sourceCoordinatesArray[x + y * width]);
    }

    testAssertions(sourceCoordinatesArray, newCoordinates);

    return {width, height, newCoordinates};
}

// horizontal flip modification of a scan
// generate a horizontal flip scan of the standard width x height rectangle
// and then map that into the sourceCoordinatesArray
function horizontalFlipRemap(width, height, sourceCoordinatesArray) {
    var horizFlipScan = [];

    // generate a horizontal flip scan of the standard width x height rectangle
    for (var y = 0; y < height; y++) {
        for (var x = width - 1; x >= 0; x--)
            horizFlipScan.push([x, y]);
    }

    // now use the horizFlipScan to find the corresponding element from the source sourceCoordinatesArray
    // i.e. for each coordinate in horizFlipScan, find the corresponding coordinate in sourceCoordinatesArray
    var newCoordinates = [];
    for (var i = 0; i < horizFlipScan.length; i++) {
        var x = horizFlipScan[i][0];
        var y = horizFlipScan[i][1];
        newCoordinates.push(sourceCoordinatesArray[x + y * width]);
    }

    testAssertions(sourceCoordinatesArray, newCoordinates);

    return {width, height, newCoordinates};
}

// vertical flip modification of a scan
// generate a vertical flip scan of the standard width x height rectangle
// and then map that into the sourceCoordinatesArray
function verticalFlipRemap(width, height, sourceCoordinatesArray) {
    var vertFlipScan = [];

    // generate a vertical flip scan of the standard width x height rectangle
    for (var y = height - 1; y >= 0; y--) {
        for (var x = 0; x < width; x++)
            vertFlipScan.push([x, y]);
    }

    // now use the vertFlipScan to find the corresponding element from the source sourceCoordinatesArray
    // i.e. for each coordinate in vertFlipScan, find the corresponding coordinate in sourceCoordinatesArray
    var newCoordinates = [];
    for (var i = 0; i < vertFlipScan.length; i++) {
        var x = vertFlipScan[i][0];
        var y = vertFlipScan[i][1];
        newCoordinates.push(sourceCoordinatesArray[x + y * width]);
    }

    testAssertions(sourceCoordinatesArray, newCoordinates);

    return {width, height, newCoordinates};
}


// rotate 90 degrees clockwhise modification of a scan
// e.g. the standard row-by-row visit of the 3x2 rectangle
//   [0,0] [1,0] [2,0] , [0,1] [1,1] [2,1]
// is now visited from right to left, top to bottom
//   [0,1] [0,0] , [1,1] [1,0] , [2,1] [2,0]

function turn90DegreesRightRemap(width, height, sourceCoordinatesArray) {
    // loop from left column to right column
    //   loop from bottom row to top row
    //      get the (x,y) coordinate and map it to the sourceCoordinatesArray
    var turn90DegreesRightScan = [];
    for (var x = 0; x < width; x++) {
        for (var y = height - 1; y >= 0; y--) {
            turn90DegreesRightScan.push([x, y]);
        }
    }

    // now use the turn90DegreesRightScan to find the corresponding element from the source sourceCoordinatesArray
    // i.e. for each coordinate in turn90DegreesRightScan, find the corresponding coordinate in sourceCoordinatesArray
    var newCoordinates = [];
    for (var i = 0; i < turn90DegreesRightScan.length; i++) {
        var x = turn90DegreesRightScan[i][0];
        var y = turn90DegreesRightScan[i][1];
        newCoordinates.push(sourceCoordinatesArray[x + y * width]);
    }
    
    testAssertions(sourceCoordinatesArray, newCoordinates);

    // note the swap of the dimensions
    return {width: height, height: width, newCoordinates};
}


// Generalized Hilbert ('gilbert') space-filling curve for arbitrary-sized
// 2D rectangular grids by Jakub Červený.
// Generates discrete 2D coordinates to fill a rectangle
// of size (width x height).


function sgn(x) {
    return x < 0 ? -1 : x > 0 ? 1 : 0;
}

function* generate2d(x, y, ax, ay, bx, by) {
    const w = Math.abs(ax + ay);
    const h = Math.abs(bx + by);

    const [dax, day] = [sgn(ax), sgn(ay)]; // unit major direction
    const [dbx, dby] = [sgn(bx), sgn(by)]; // unit orthogonal direction

    if (h === 1) {
        // trivial row fill
        for (let i = 0; i < w; i++) {
            yield [x, y];
            [x, y] = [x + dax, y + day];
        }
        return;
    }

    if (w === 1) {
        // trivial column fill
        for (let i = 0; i < h; i++) {
            yield [x, y];
            [x, y] = [x + dbx, y + dby];
        }
        return;
    }

    var [ax2, ay2] = [Math.floor(ax / 2), Math.floor(ay / 2)];
    var [bx2, by2] = [Math.floor(bx / 2), Math.floor(by / 2)];

    const w2 = Math.abs(ax2 + ay2);
    const h2 = Math.abs(bx2 + by2);

    if (2 * w > 3 * h) {
        if (w2 % 2 && w > 2) {
            // prefer even steps
            [ax2, ay2] = [ax2 + dax, ay2 + day];
        }

        // long case: split in two parts only
        yield* generate2d(x, y, ax2, ay2, bx, by);
        yield* generate2d(x + ax2, y + ay2, ax - ax2, ay - ay2, bx, by);
    } else {
        if (h2 % 2 && h > 2) {
            // prefer even steps
            [bx2, by2] = [bx2 + dbx, by2 + dby];
        }

        // standard case: one step up, one long horizontal, one step down
        yield* generate2d(x, y, bx2, by2, ax2, ay2);
        yield* generate2d(x + bx2, y + by2, ax, ay, bx - bx2, by - by2);
        yield* generate2d(
            x + (ax - dax) + (bx2 - dbx),
            y + (ay - day) + (by2 - dby),
            -bx2,
            -by2,
            -(ax - ax2),
            -(ay - ay2)
        );
    }
}

function gilbert2d(width, height) {
    if (width >= height) {
        return generate2d(0, 0, width, 0, 0, height);
    } else {
        return generate2d(0, 0, 0, height, width, 0);
    }
}

// hilbert visit
function gilbert2dRemap(width, height, sourceCoordinatesArray) {
    
    // collect a standard hilbert visit
    var hilbertScan = [];
    for (const [x, y] of gilbert2d(10, 11)) {
        hilbertScan.push([x, y]);
    }

    // now use the hilbertScan to find the corresponding element from the source sourceCoordinatesArray
    // i.e. for each coordinate in hilbertScan, find the corresponding coordinate in sourceCoordinatesArray
    var newCoordinates = [];
    for (var i = 0; i < hilbertScan.length; i++) {
        var x = hilbertScan[i][0];
        var y = hilbertScan[i][1];
        newCoordinates.push(sourceCoordinatesArray[x + y * width]);
    }

    testAssertions(sourceCoordinatesArray, newCoordinates);

    return {width, height, newCoordinates};
}
