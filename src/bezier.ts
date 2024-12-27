export default class BezierEasing {
    static readonly NEWTON_ITERATIONS = 4;
    static readonly NEWTON_MIN_SLOPE = 0.001;
    static readonly SUBDIVISION_PRECISION = 0.0000001;
    static readonly SUBDIVISION_MAX_ITERATIONS = 10;

    static readonly kSplineTableSize = 11;
    static readonly kSampleStepSize = 1.0 / (BezierEasing.kSplineTableSize - 1.0);

    static float32ArraySupported = 'Float32Array' in global;

    private readonly mSampleValues: number[] | Float32Array<ArrayBuffer>;

    private readonly mX1: number;
    private readonly mX2: number;
    private readonly mY1: number;
    private readonly mY2: number;

    private _precomputed = false;

    constructor(mX1: number, mY1: number, mX2: number, mY2: number) {
        // Validate arguments
        if (arguments.length !== 4) {
            throw new Error('BezierEasing requires 4 arguments.');
        }
        for (var i = 0; i < 4; ++i) {
            if (typeof arguments[i] !== 'number' || isNaN(arguments[i]) || !isFinite(arguments[i])) {
                throw new Error('BezierEasing arguments should be integers.');
            }
        }
        if (mX1 < 0 || mX1 > 1 || mX2 < 0 || mX2 > 1) {
            throw new Error('BezierEasing x values must be in [0, 1] range.');
        }

        this.mSampleValues = BezierEasing.float32ArraySupported ? new Float32Array(BezierEasing.kSplineTableSize) : new Array(BezierEasing.kSplineTableSize);

        this.mX1 = mX1;
        this.mY1 = mY1;
        this.mX2 = mX2;
        this.mY2 = mY2;
    }

    static A(aA1: number, aA2: number) {
        return 1.0 - 3.0 * aA2 + 3.0 * aA1;
    }

    static B(aA1: number, aA2: number) {
        return 3.0 * aA2 - 6.0 * aA1;
    }

    static C(aA1: number) {
        return 3.0 * aA1;
    }

    static calcBezier(aT: number, aA1: number, aA2: number) {
        return ((BezierEasing.A(aA1, aA2) * aT + BezierEasing.B(aA1, aA2)) * aT + BezierEasing.C(aA1)) * aT;
    }

    static getSlope(aT: number, aA1: number, aA2: number) {
        return 3.0 * BezierEasing.A(aA1, aA2) * aT * aT + 2.0 * BezierEasing.B(aA1, aA2) * aT + BezierEasing.C(aA1);
    }

    binarySubdivide(aX: number, aA: number, aB: number) {
        var currentX,
            currentT,
            i = 0;
        do {
            currentT = aA + (aB - aA) / 2.0;
            currentX = BezierEasing.calcBezier(currentT, this.mX1, this.mX2) - aX;
            if (currentX > 0.0) {
                aB = currentT;
            } else {
                aA = currentT;
            }
        } while (Math.abs(currentX) > BezierEasing.SUBDIVISION_PRECISION && ++i < BezierEasing.SUBDIVISION_MAX_ITERATIONS);
        return currentT;
    }

    newtonRaphsonIterate(aX: number, aGuessT: number) {
        for (var i = 0; i < BezierEasing.NEWTON_ITERATIONS; ++i) {
            var currentSlope = BezierEasing.getSlope(aGuessT, this.mX1, this.mX2);
            if (currentSlope === 0.0) return aGuessT;
            var currentX = BezierEasing.calcBezier(aGuessT, this.mX1, this.mX2) - aX;
            aGuessT -= currentX / currentSlope;
        }
        return aGuessT;
    }

    calcSampleValues() {
        for (var i = 0; i < BezierEasing.kSplineTableSize; ++i) {
            this.mSampleValues[i] = BezierEasing.calcBezier(i * BezierEasing.kSampleStepSize, this.mX1, this.mX2);
        }
    }

    getTForX(aX: number) {
        var intervalStart = 0.0;
        var currentSample = 1;
        var lastSample = BezierEasing.kSplineTableSize - 1;

        for (; currentSample != lastSample && this.mSampleValues[currentSample] <= aX; ++currentSample) {
            intervalStart += BezierEasing.kSampleStepSize;
        }
        --currentSample;

        // Interpolate to provide an initial guess for t
        var dist = (aX - this.mSampleValues[currentSample]) / (this.mSampleValues[currentSample + 1] - this.mSampleValues[currentSample]);
        var guessForT = intervalStart + dist * BezierEasing.kSampleStepSize;

        var initialSlope = BezierEasing.getSlope(guessForT, this.mX1, this.mX2);
        if (initialSlope >= BezierEasing.NEWTON_MIN_SLOPE) {
            return this.newtonRaphsonIterate(aX, guessForT);
        } else if (initialSlope === 0.0) {
            return guessForT;
        } else {
            return this.binarySubdivide(aX, intervalStart, intervalStart + BezierEasing.kSampleStepSize);
        }
    }

    precompute() {
        this._precomputed = true;
        if (this.mX1 != this.mY1 || this.mX2 != this.mY2) this.calcSampleValues();
    }

    evaluate(aX: number) {
        if (!this._precomputed) this.precompute();
        if (this.mX1 === this.mY1 && this.mX2 === this.mY2) return aX; // linear
        // Because JavaScript number are imprecise, we should guarantee the extremes are right.
        if (aX <= 0) return 0;
        if (aX >= 1) return 1;
        return BezierEasing.calcBezier(this.getTForX(aX), this.mY1, this.mY2);
    }
}
