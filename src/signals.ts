import { HandleSignalsOptions } from "./types";

/*----------------------------------------------------------------------------------------------
 *  Copyright (c) Lennart C. L. Kats.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *----------------------------------------------------------------------------------------------*/
const shellEscape = require("any-shell-escape");

let isActive = false;
let options: Required<HandleSignalsOptions> = {timeout: null};
let signalReceived: string | undefined;

const handleSignal = (signal: string) => {
    if (!signalReceived && options.timeout) {
        setTimeout(() => {
            handleSignalsEnd();
            process.kill(process.pid, signal);
        }, options.timeout);
    }
    signalReceived = signal;
}
const handleSignalInt = () => handleSignal("SIGINT");
const handleSignalTerm = () => handleSignal("SIGTERM");
const handleSignalQuit = () => handleSignal("SIGQUIT");

/** @internal */
export function handleSignals(_options?: HandleSignalsOptions) {
    Object.assign(options, _options);
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
    const match = signal.match(/^\0(SIGINT|SIGQUIT|SIGTERM|SIGTIMEOUT)/);
    if (!match) return;
    if (match[1] === "SIGTIMEOUT") {
        handleSignalsEnd();
        return process.kill(process.pid, signalReceived);
    }
    signalReceived = match[1] || signalReceived;
}

/**
 * Add a wrapper script that intercepts Control-C presses.
 * @internal
 */
export function wrapDisableInterrupts(script: string) {
    // Launch a new shell as a background process, intercepting any Control-C
    // sent to the foreground. Not efficient, but effective.
    return `:
        TRAPPED=
        TIMEOUT=
        triggerTimeout() {
            local PID=$$
            ${options.timeout
                ? `(sleep ${Math.round(options.timeout / 1000)}; kill -SIGUSR1 $PID 2>/dev/null) &`
                : ``}
        }
        onTimeout() {
            printf '\\0SIGTIMEOUT'>&3
            trap : TERM
            kill -TERM $CHILD_PID 2>/dev/null
            wait $CHILD_PID
        }
        trap "TRAPPED=1; printf '\\0SIGINT'>&3; trap : INT; triggerTimeout" INT
        trap "TRAPPED=1; printf '\\0SIGQUIT'>&3; trap : QUIT; triggerTimeout" QUIT
        trap "TRAPPED=1; printf '\\0SIGTERM'>&3; trap : TERM; triggerTimeout" TERM
        trap onTimeout USR1

        $SHELL -c ${shellEscape(script)} </dev/stdin &
        CHILD_PID=$!
        
        while true; do
            wait $CHILD_PID
            RET=$?
            if [ "$TRAPPED" ]; then
                TRAPPED=
            else
                exit $RET
            fi
        done
    `;
}