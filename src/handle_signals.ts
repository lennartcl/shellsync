/*----------------------------------------------------------------------------------------------
 *  Copyright (c) Lennart C. L. Kats.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *----------------------------------------------------------------------------------------------*/
const shellEscape = require("any-shell-escape");

let isActive = false;
let signalReceived: string | undefined;

const handleSignal = (signal: string) => {
    signalReceived = signal;
}
const handleSignalInt = () => handleSignal("SIGINT");
const handleSignalTerm = () => handleSignal("SIGTERM");
const handleSignalQuit = () => handleSignal("SIGQUIT");

/** @internal */
export function handleSignals() {
    if (signalReceived) handleSignalsEnd();
    isActive = true;
    process.on("SIGINT", handleSignalInt);
    process.on("SIGQUIT", handleSignalQuit);
    process.on("SIGTERM", handleSignalTerm);
}

/** @internal */
export function handleSignalsEnd() {
    isActive = false;
    process.removeListener("SIGINT", handleSignalInt);
    process.removeListener("SIGQUIT", handleSignalQuit);
    process.removeListener("SIGTERM", handleSignalTerm);
    if (signalReceived) process.kill(process.pid, signalReceived);
}

/** @internal */
export function isHandleSignalsActive() {
    return isActive;
}

/** @internal */
export function parseEmittedSignal(signal: string) {
    const match = signal.match(/^\0(SIGINT|SIGQUIT|SIGTERM)/);
    signalReceived = match && match[1] || signalReceived;
}

/**
 * Add a wrapper script that intercepts Control-C presses.
 * @internal
 */
export function wrapDisableInterrupts(script: string) {
    // Launch a new shell as a background process, intercepting any Control-C
    // sent to the foreground. Not efficient, but effective.
    return `
        TRAPPED=
        trap "TRAPPED=1; printf '\\0SIGINT'>&3; trap : INT" INT
        trap "TRAPPED=1; printf '\\0SIGQUIT'>&3; trap : QUIT" QUIT
        trap "TRAPPED=1; printf '\\0SIGQUIT'>&3; trap : TERM" TERM

        $SHELL -c ${shellEscape(script)} </dev/stdin &
        PID=$!
        
        while true; do
            wait $PID
            RET=$?
            if [[ $TRAPPED ]]; then
                TRAPPED=
            else
                exit $RET
            fi
        done
    `;
}