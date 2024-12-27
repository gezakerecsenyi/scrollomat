import BezierEasing from './bezier';

interface ScrollInstruction {
    element: HTMLElement;
    instruction: string;
    name: string;
}

type EasingCurve = [number, number, number, number];

interface AbsoluteData {
    value?: string[];
    destination?: number;
    destinations?: number[];
    easingFunction?: EasingCurve;
}

interface CompiledScrollInstruction extends ScrollInstruction {
    enterAt: number;
    duration: number;
    yEasingCurve: EasingCurve;
    opacityEasingCurve: EasingCurve;
    scrollListeners: {
        xEasingFunction: (scroll: number) => string;
        yEasingFunction: (scroll: number) => string;
        opacityEasingFunction: (scroll: number) => string;
        [key: string]: (scroll: number) => string;
    };
    leaveAt: number;
    absoluteY: AbsoluteData;
    absoluteX: AbsoluteData;
    isAbsolute: boolean;
}

type CompilationMap = { [key: string]: CompiledScrollInstruction };

interface CompilationReport {
    compilationResult: CompiledScrollInstruction[];
    maxHeight: number;
}

interface CompiledAbsoluteSegment {
    byTime: number;
    startPos: number;
    endPos: number;
    ease: EasingCurve;
}

type Directive = 'enter' | 'ease' | 'duration' | 'leave' | 'opacity-ease' | 'y' | 'x';

export default class Scrollomat {
    compilationResult?: CompiledScrollInstruction[];
    private canvas: HTMLElement;
    private entries: ScrollInstruction[];
    private scrollPlaceholder?: HTMLDivElement;
    private maxHeight: number = 100;

    constructor(canvas: HTMLElement) {
        this.canvas = canvas;
        this.entries = [];

        this.loadCanvas();
    }

    static computeBezier(t: number, x1: number, y1: number, x2: number, y2: number): number {
        if (t >= 1) {
            return 1;
        }

        if (t <= 0) {
            return 0;
        }

        return new BezierEasing(x1, y1, x2, y2).evaluate(t);
    }

    static getEasingFunction(easingCurve: EasingCurve, entry: ScrollInstruction) {
        return (t: number) => `${100 - Scrollomat.computeBezier(
            t,
            ...easingCurve,
        ) * (100 + entry.element.getBoundingClientRect().height / window.innerHeight * 100)}vh`;
    }

    loadCanvas() {
        const children = Array
            .from(this.canvas.children)
            .filter(e => e.hasAttribute('scroll-data'));

        children.forEach(e => this.loadScrollData(e as HTMLElement));
    }

    loadScrollData(element: HTMLElement) {
        if (!element.getAttribute('id')) {
            element.setAttribute('id', Math.random().toString());
        }

        element.classList.add('scrollable');
        element.style.top = `200vh`;

        this.entries.push({
            element,
            instruction: element.getAttribute('scroll-data')!,
            name: element.getAttribute('id')!,
        });
    }

    update() {
        const currentScrollDistance = Math.min(
            this.maxHeight,
            (-this.scrollPlaceholder!.getBoundingClientRect().top) / window.innerHeight * 100 + 100
        );

        this.compilationResult?.forEach(instruction => {
            if (instruction.isAbsolute) {
                if (instruction.enterAt > currentScrollDistance || currentScrollDistance > instruction.leaveAt) {
                    instruction.element.style.display = 'none';
                    return;
                } else {
                    instruction.element.style.display = '';
                }
            }

            const offset = (currentScrollDistance - instruction.enterAt) / instruction.duration;
            instruction.element.style.top = instruction.scrollListeners.yEasingFunction(offset);
            instruction.element.style.left = instruction.scrollListeners.xEasingFunction(offset);
            instruction.element.style.opacity = instruction.scrollListeners.opacityEasingFunction(offset);

            for (let scrollListenersKey in instruction.scrollListeners) {
                instruction.scrollListeners[scrollListenersKey](offset);
            }
        });
    }

    mountToWatcher(watcher: HTMLElement) {
        const {
            maxHeight,
            compilationResult,
        } = this.compileScrollData();
        this.compilationResult = compilationResult;
        this.maxHeight = maxHeight;

        const scrollPlaceholder = document.createElement('div');
        scrollPlaceholder.style.height = `${maxHeight}vh`;
        this.canvas.style.height = `${maxHeight}vh`;
        watcher.appendChild(scrollPlaceholder);

        this.scrollPlaceholder = scrollPlaceholder;

        watcher.addEventListener('scroll', () => {
            this.update();
        });
        this.update();
    }

    compileScrollData(): CompilationReport {
        const compilationMap: CompilationMap = {};
        let entriesToProcess = [...this.entries];

        function requestForProcessing(id: string) {
            if (compilationMap[id]) {
                return;
            }

            const entry = entriesToProcess.find(e => e.name === id)!;

            let resultHere: CompiledScrollInstruction = {
                ...entry,
                enterAt: 0,
                leaveAt: 100,
                yEasingCurve: [
                    0,
                    0,
                    1,
                    1,
                ],
                duration: 100,
                opacityEasingCurve: [
                    0,
                    1,
                    1,
                    1,
                ],
                isAbsolute: false,
                absoluteX: {},
                absoluteY: {},
                scrollListeners: {
                    xEasingFunction: () => '0vw',
                    yEasingFunction: Scrollomat.getEasingFunction([
                        0,
                        0,
                        1,
                        1,
                    ], entry),
                    opacityEasingFunction: () => '1',
                },
            };

            let isAbsolute = false;
            let instructionLines = entry
                .instruction
                .split(';')
                .map(e => e.trim())
                .filter(e => e);
            if (instructionLines[0] === '!absolute') {
                isAbsolute = true;
                resultHere.isAbsolute = true;
                instructionLines = instructionLines.slice(1);
            }

            instructionLines
                .sort((a, b) => +a.startsWith('leave ') - +b.startsWith('leave '))
                .sort((a, b) => +a.startsWith('y ') - +b.startsWith('y '))
                .forEach(instruction => {
                    const keyword = instruction.split(' ')[0] as Directive;
                    if (![
                        'enter',
                        'ease',
                        'duration',
                        'leave',
                        'opacity-ease',
                        'y',
                        'x',
                    ].includes(keyword)) {
                        console.error(`Failed to identify directive '${keyword}' in ${entry.name}.`);
                        return;
                    }

                    let dataParameter = instruction.trim().split(/ +/).slice(1);

                    let foundDataValue: number | null = null;
                    let foundDataSource: CompiledScrollInstruction | null = null;
                    if (dataParameter[0] === 'like') {
                        requestForProcessing(dataParameter[1]);
                        foundDataSource = compilationMap[dataParameter[1]];
                    }

                    function checkAllowReferent() {
                        if (![
                            'enter',
                            'leave',
                        ].includes(keyword)) {
                            console.error(`Invalid referent '${dataParameter[0]}' for directive '${keyword}' in ${entry.name}.`);
                            return false;
                        }

                        requestForProcessing(dataParameter[1]);
                        return true;
                    }

                    if (dataParameter[0] === 'with-entry') {
                        if (checkAllowReferent()) {
                            foundDataValue = compilationMap[dataParameter[1]].enterAt;
                        }
                    }

                    if (dataParameter[0] === 'with-exit') {
                        if (checkAllowReferent()) {
                            foundDataValue =
                                compilationMap[dataParameter[1]].enterAt + compilationMap[dataParameter[1]].duration;
                        }
                    }

                    if (dataParameter[0] === 'after-entry') {
                        if (checkAllowReferent()) {
                            foundDataValue = compilationMap[dataParameter[1]].enterAt + parseInt(dataParameter[2]);
                        }
                    }

                    if (dataParameter[0] === 'after-exit') {
                        if (checkAllowReferent()) {
                            foundDataValue =
                                compilationMap[dataParameter[1]].enterAt + compilationMap[dataParameter[1]].duration + parseInt(
                                    dataParameter[2]);
                        }
                    }

                    switch (keyword) {
                        case 'enter':
                            if (foundDataSource) {
                                resultHere.enterAt = foundDataSource.enterAt;
                                return;
                            }

                            if (foundDataValue !== null) {
                                resultHere.enterAt = foundDataValue;
                                return;
                            }

                            if (dataParameter.length > 1) {
                                console.error(`Unexpected parameters for directive '${keyword}' in ${entry.name}.`);
                                return;
                            }

                            resultHere.enterAt = parseInt(dataParameter[0]);

                            break;
                        case 'leave':
                            if (foundDataSource) {
                                resultHere.duration =
                                    (foundDataSource.enterAt + foundDataSource.duration) - resultHere.enterAt;
                                return;
                            }

                            if (foundDataValue !== null) {
                                resultHere.duration = foundDataValue - resultHere.enterAt;
                                return;
                            }

                            if (dataParameter.length > 1) {
                                console.error(`Unexpected parameters for directive '${keyword}' in ${entry.name}.`);
                                return;
                            }

                            resultHere.enterAt = parseInt(dataParameter[0]) - resultHere.enterAt;

                            break;
                        case 'ease':
                            if (isAbsolute) {
                                console.error(`Cannot use directive 'ease' in !absolute mode (${entry.name}). Use | notation with absolute directives instead.`);
                                return;
                            }

                            if (foundDataSource) {
                                resultHere.yEasingCurve = foundDataSource.yEasingCurve;
                                return;
                            }

                            if (dataParameter.length !== 4) {
                                console.error(`Malformed parameters for directive '${keyword}' in ${entry.name}.`);
                                return;
                            }

                            resultHere.yEasingCurve = dataParameter.map(e => parseFloat(e)) as EasingCurve;
                            resultHere.scrollListeners.yEasingFunction =
                                Scrollomat.getEasingFunction(resultHere.yEasingCurve, resultHere);

                            break;
                        case 'opacity-ease':
                            if (foundDataSource) {
                                resultHere.opacityEasingCurve = foundDataSource.opacityEasingCurve;
                                resultHere.scrollListeners.opacityEasingFunction =
                                    foundDataSource.scrollListeners.opacityEasingFunction;
                                return;
                            }

                            if (dataParameter.length !== 4 && dataParameter.length !== 8) {
                                console.error(`Malformed parameters for directive '${keyword}' in ${entry.name}.`);
                                return;
                            }

                            resultHere.opacityEasingCurve = dataParameter.map(e => parseInt(e)) as EasingCurve;

                            if (dataParameter.length === 4) {
                                resultHere.scrollListeners.opacityEasingFunction =
                                    (t: number) => `${Scrollomat.computeBezier(
                                        t,
                                        ...resultHere.opacityEasingCurve,
                                    )}`;
                            } else {
                                resultHere.scrollListeners.opacityEasingFunction = (t: number) => {
                                    const extraT = isAbsolute ?
                                        0 :
                                        entry.element.getBoundingClientRect().height / window.innerHeight;

                                    if (t < 0.5) {
                                        return `${Scrollomat.computeBezier(
                                            t * 2 - extraT * 1.5,
                                            ...resultHere.opacityEasingCurve,
                                        )}`;
                                    } else {
                                        return `${1 - Scrollomat.computeBezier(
                                            t * 2 - 1 - extraT * 1.5,
                                            ...resultHere.opacityEasingCurve.slice(4) as EasingCurve,
                                        )}`;
                                    }
                                };
                            }

                            break;
                        case 'duration':
                            if (foundDataSource) {
                                resultHere.duration = foundDataSource.duration;
                                return;
                            }

                            if (dataParameter.length > 1) {
                                console.error(`Unexpected parameters for directive '${keyword}' in ${entry.name}.`);
                                return;
                            }

                            resultHere.duration = parseInt(dataParameter[0]);

                            break;
                        case 'x':
                        case 'y':
                            if (!isAbsolute) {
                                console.error(`Cannot use directive '${keyword}' outside of !absolute mode (${entry.name}).`);
                            }

                            const absoluteKey = keyword === 'x' ? 'absoluteX' : 'absoluteY';
                            const easingKey = keyword === 'x' ? 'xEasingFunction' : 'yEasingFunction';
                            const distanceUnit = keyword === 'x' ? 'vw' : 'vh';

                            resultHere[absoluteKey].value = dataParameter;

                            if (foundDataSource) {
                                dataParameter = foundDataSource[absoluteKey].value!;
                            }

                            if (dataParameter.length === 1) {
                                resultHere[absoluteKey].destination = parseInt(dataParameter[0]);
                                resultHere.scrollListeners[easingKey] =
                                    () => `${resultHere[absoluteKey].destination}${distanceUnit}`;
                                return;
                            }

                            if (!instruction.includes(':')) {
                                const pipeIndex = dataParameter.indexOf('|');
                                const prePipe = dataParameter.slice(
                                    0,
                                    pipeIndex > -1 ? pipeIndex : dataParameter.length,
                                );

                                let likeIndex = -1;
                                do {
                                    let likeIndex = prePipe.indexOf('like');
                                    if (likeIndex > -1) {
                                        requestForProcessing(prePipe[likeIndex + 1]);

                                        const res = compilationMap[prePipe[likeIndex + 1]][absoluteKey].value;
                                        if (res && res.length === 1) {
                                            dataParameter.splice(likeIndex, 2, ...res);
                                        }
                                    }
                                } while (likeIndex > -1);

                                let easingCurveHere: EasingCurve = [
                                    0,
                                    0,
                                    1,
                                    1,
                                ];
                                if (dataParameter.includes('|')) {
                                    if (dataParameter.slice(-1)[0] !== '|') {
                                        console.error(`Invalid | notation in directive '${keyword} in ${entry.name}.`);
                                        return;
                                    }

                                    const easingData = dataParameter.slice(pipeIndex + 1, -1);

                                    if (easingData[0] === 'like') {
                                        requestForProcessing(easingData[1]);
                                        easingCurveHere = compilationMap[easingData[1]][absoluteKey].easingFunction ||
                                            compilationMap[easingData[1]].yEasingCurve;

                                        if (!easingCurveHere) {
                                            console.error(`Invalid reference in | notation in directive '${keyword}' in ${entry.name}.`);
                                        }
                                    } else if (easingData.length === 4) {
                                        easingCurveHere = easingData.map(e => parseInt(e)) as EasingCurve;
                                    } else {
                                        console.error(`Malformed parameters for | notation in directive '${keyword}' in ${entry.name}.`);
                                        return;
                                    }
                                }

                                resultHere.scrollListeners[easingKey] = (t: number) => {
                                    const interval = t * (prePipe.length - 1);
                                    const segment = Math.min(prePipe.length - 2, Math.floor(interval));
                                    const excess = interval - segment;

                                    return `${
                                        parseInt(prePipe[segment]) + Scrollomat.computeBezier(
                                            excess,
                                            ...easingCurveHere,
                                        ) * (
                                            parseInt(prePipe[segment + 1]) -
                                            parseInt(prePipe[segment])
                                        )
                                    }${distanceUnit}`;
                                };

                                return;
                            } else {
                                // pattern: ( number | +number | (relation identifier) ): [( number | (like identifier)
                                // )] - ( number | (like identifier) ) | ((number number number number) | like
                                // identifier) | time  | +offset |            time        : [      fixed start pos
                                //    ] -           end pos              |                       easing
                                //      |

                                /*
                                    [
                            1            +?
                            2            offset/time?
                            3            relation?
                            4            identifier?
                            5            pos?
                            6            like?
                            7            identifier?
                            8            pos?
                            9            like?
                            10           identifier?
                            11           ease numbers?
                            12           like?
                            13           identifier?
                                    ]
                                 */

                                if (dataParameter[1] !== '.') {
                                    console.error(`Unspecified start location in directive '${keyword}' in ${entry.name}.`);
                                    return;
                                }

                                const initialPos = parseInt(dataParameter[0]);

                                let fullParameter = dataParameter
                                    .slice(2)
                                    .join(' ');

                                const argSegmenterRegexp = /(?:(\+)?(-?\d+)|(like|with-exit|with-entry) ([a-zA-Z0-9-.]+)): (?:(-?\d+)|(like) ([a-zA-Z0-9-.]+))? ?- (?:(-?\d+)|(like) ([a-zA-Z0-9-.]+)) \| (?:([0-9.]+ [0-9.]+ [0-9.]+ [0-9.]+)|(like) ([a-zA-Z0-9-.]+)) \|/g;
                                const residual = fullParameter
                                    .replace(argSegmenterRegexp, '')
                                    .trim();

                                if (residual.length) {
                                    console.error(`Failed to segment structure of directive '${keyword}' in ${entry.name}.`);
                                    return;
                                }

                                const segmentedArg = Array.from(
                                    fullParameter.matchAll(argSegmenterRegexp),
                                );

                                let latestTime = 0;
                                let lastPos = 0;
                                const segments: CompiledAbsoluteSegment[] = [];
                                segmentedArg.forEach(segment => {
                                    const segmentHere: CompiledAbsoluteSegment = {
                                        byTime: latestTime,
                                        startPos: lastPos,
                                        endPos: lastPos,
                                        ease: [
                                            0,
                                            0,
                                            1,
                                            1,
                                        ],
                                    };

                                    if (segment[2]) {
                                        const timeData = parseInt(segment[2]);

                                        if (segment[1] === '+') {
                                            segmentHere.byTime = latestTime + timeData;
                                        } else if (segment[1]) {
                                            console.error(`Unexpected token ${segment[1]} in directive '${keyword}' in ${entry.name}.`);
                                            return;
                                        } else {
                                            segmentHere.byTime = timeData;
                                        }
                                    } else if (segment[3] && segment[4]) {
                                        requestForProcessing(segment[4]);

                                        switch (segment[3]) {
                                            case 'like':
                                                segmentHere.byTime =
                                                    compilationMap[segment[4]].leaveAt - resultHere.enterAt;
                                                break;
                                            case 'with-exit':
                                                segmentHere.byTime =
                                                    compilationMap[segment[4]].leaveAt - resultHere.enterAt;
                                                break;
                                            case 'with-entry':
                                                segmentHere.byTime =
                                                    compilationMap[segment[4]].enterAt - resultHere.enterAt;
                                                break;
                                        }
                                    } else {
                                        console.error(`Failed to parse segment '${segment[0]}' in directive '${keyword}' in ${entry.name} (missing time specifier).`);
                                        return;
                                    }

                                    ([
                                        [
                                            'startPos',
                                            5,
                                        ],
                                        [
                                            'endPos',
                                            8,
                                        ],
                                    ] as const).forEach((data) => {
                                        if (segment[data[1]]) {
                                            segmentHere[data[0]] = parseInt(segment[data[1]]);
                                        }

                                        if (segment[data[1] + 1]) {
                                            requestForProcessing(segment[data[1] + 2]);

                                            const res = compilationMap[segment[data[1] + 2]][absoluteKey].destination;

                                            if (res === undefined) {
                                                console.error(`Invalid reference to ${segment[data[1] + 2]} in directive '${keyword}' in ${entry.name} (must be a single-place ${keyword} directive).`);
                                                return;
                                            }

                                            segmentHere[data[0]] = res;
                                        }
                                    });

                                    if (segment[11]) {
                                        segmentHere.ease =
                                            segment[11].split(' ').map(e => parseFloat(e)) as EasingCurve;
                                    } else if (segment[12]) {
                                        requestForProcessing(segment[13]);

                                        const res = compilationMap[segment[13]].yEasingCurve;
                                        if (res) {
                                            segmentHere.ease = res;
                                        }
                                    }

                                    latestTime = segmentHere.byTime;
                                    lastPos = segmentHere.endPos;
                                    segments.push(segmentHere);
                                });

                                segments.sort((a, b) => b.byTime - a.byTime);
                                resultHere.scrollListeners[easingKey] = (t: number) => {
                                    const absTime = t * resultHere.duration;
                                    let lastCheckpointIndex = segments.findIndex(e => e.byTime <= absTime);
                                    let lastCheckpoint = segments[lastCheckpointIndex];
                                    let currentCheckpoint = segments[lastCheckpointIndex - 1];

                                    if (!lastCheckpoint) {
                                        lastCheckpoint = {
                                            byTime: 0,
                                            startPos: 0,
                                            endPos: initialPos,
                                            ease: [
                                                0,
                                                0,
                                                1,
                                                1,
                                            ],
                                        };
                                        currentCheckpoint = segments.slice(-1)[0];
                                    }

                                    if (!currentCheckpoint) {
                                        currentCheckpoint = lastCheckpoint;
                                    }

                                    const elapsedTime = absTime - lastCheckpoint.byTime;
                                    const currentDuration = Math.max(
                                        1,
                                        currentCheckpoint.byTime - lastCheckpoint.byTime,
                                    );

                                    return `${
                                        currentCheckpoint.startPos + Scrollomat.computeBezier(
                                            elapsedTime / currentDuration,
                                            ...currentCheckpoint.ease,
                                        ) * (currentCheckpoint.endPos - currentCheckpoint.startPos)
                                    }${distanceUnit}`;
                                };
                            }

                            break;
                    }
                });

            resultHere.leaveAt = resultHere.enterAt + resultHere.duration;
            compilationMap[entry.name] = resultHere;
            entriesToProcess = entriesToProcess.filter(t => t.name !== id);
        }

        while (entriesToProcess.length > 0) {
            requestForProcessing(entriesToProcess[0].name);
        }

        const compilationResult = Object.values(compilationMap);
        return {
            compilationResult,
            maxHeight: Math.max(...compilationResult.map(e => e.enterAt + e.duration)) - 100,
        };
    }
}
