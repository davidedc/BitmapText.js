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

for (const [x, y] of gilbert2d(10, 11)) {
    console.log(x, y);
}