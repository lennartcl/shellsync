/*----------------------------------------------------------------------------------------------
 *  Copyright (c) Lennart C. L. Kats.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *----------------------------------------------------------------------------------------------*/
import * as assert from "assert";
import {quote, unquoted} from "../src/index";
import defaultExportSh from "../src/index";
import {sh} from "../src/index";
import {shh} from "../src/index";
import * as path from "path";

const stdioDefault = [0, "pipe", "inherit", "pipe", "pipe"];
const consoleLog = console.log;
const consoleError = console.error;

describe('#quote', () => {
    it('supports strings without args', () => {
        const escaped = quote(`foo "bar"` as any);
        assert.equal(escaped, `foo "bar"`);
    });
    
    it('supports strings without args in template form', () => {
        const escaped = quote`foo "bar"`;
        assert.equal(escaped, `foo "bar"`);
    });
    
    it('supports tagged templates', () => {
        const bar = "bar";
        const baz = '"baz"';
        const escaped = quote`foo ${bar} ${baz}`;
        assert.equal(escaped, `foo bar '"baz"'`);
    });
    
    it('supports string arguments', () => {
        const bar = "bar";
        const baz = '"baz"';
        const escaped = quote("foo" as any, bar, baz, null as any, undefined as any);
        assert.equal(escaped, `foo bar '"baz"' '' ''`);
    });
    
    it('supports unescaped arguments', () => {
        const args = "bar baz";
        const escaped = quote`foo ${unquoted(args)} ${unquoted()}`;
        assert.equal(escaped, `foo bar baz `);
    });

    it('supports falsy arguments', () => {
        const escaped = quote`foo ${false} ${null as any} ${0}`;
        assert.equal(escaped, `foo false '' 0`);
    });

    it('fails on undefined', (next) => {
        try {
            quote`foo ${false} ${undefined as any} ${0}`;
        } catch (e) {
            next();
        }
    });

    it('supports optional typed values with ! suffix', () => {
        interface Foo {
            opt?: string
        }
        const foo: Foo = {opt: "opt"};
        quote `foo.opt = ${foo.opt!}`
    });

    it('supports plain string arguments', () => {
        const escaped = quote("echo hi" as any);
        assert.equal(escaped, "echo hi");
    });

    it("supports arguments inside single-quoted areas", () => {
        const foobar = "foo bar";
        const escaped = quote`echo 'echo ${foobar}'`;
        assert.equal(escaped, `echo 'echo foo bar'`);
    });

    it("supports arguments inside double-quoted areas", () => {
        const foobar = "foo bar";
        const escaped = quote`echo "echo ${foobar}"`;
        assert.equal(escaped, `echo "echo foo bar"`);
    });

    it("supports arguments with escaped quotes", () => {
        const foobar = "foo bar";
        const escaped = quote`echo \\"echo ${foobar}\\"`;
        assert.equal(escaped, `echo \\"echo 'foo bar'\\"`);
    });

    it("supports arguments with shell expressions in quotes", () => {
        const foobar = "foo bar";
        const escaped = quote`echo "echo $(${foobar})"`;
        assert.equal(escaped, `echo "echo $('foo bar')"`);
    });

    it("supports arguments with backtick expressions in quotes", () => {
        const foobar = "foo bar";
        const escaped = quote`echo "echo \`${foobar}\``;
        assert.equal(escaped, `echo "echo \`'foo bar'\``);
    });

    it("supports arguments with quotes in shell expressions in quotes", () => {
        const foobar = "foo bar";
        const escaped = quote`echo "echo $("${foobar}")"`;
        assert.equal(escaped, `echo "echo $("foo bar")"`);
    });

    it("supports arguments with quotes in shell expressions in shell expressions", () => {
        const foobar = "foo bar";
        const escaped = quote`echo "echo $($("${foobar}"))"`;
        assert.equal(escaped, `echo "echo $($("foo bar"))"`);
    });
});

describe('#createShell', () => {
    afterEach(() => {
        console.log = consoleLog;
        console.error = consoleError;
        sh.options.shell = "/bin/bash";
        sh.unmockAllCommands();
        sh.handleSignalsEnd();
    });
    
    it('can echo', () => {
        const hoi = `"hoi"`;
        const result = sh `echo ${hoi}`;
        assert.equal(result, `"hoi"`);
    });

    it('respects cwd', () => {
        sh.options.cwd = "/";
        const result = sh `echo $PWD`;
        assert.equal(result, `/`);
    });
    
    it('respects cd', () => {
        sh.options.cwd = "/";
        sh `cd tmp`;
        assert.equal(sh.options.cwd, `/tmp`);
    });
    
    it('respects cd for shh', () => {
        shh.options.cwd = "/";
        shh `cd tmp`;
        assert.equal(sh.options.cwd, `/tmp`);
    });
    
    it('supports .test()', () => {
        const result2 = sh.test `exit 0`;
        assert.equal(result2, true);
        const result1 = sh.test `exit 1`;
        assert.equal(result1, false);
    });
    
    it('respects exit codes', () => {
        try {
            sh.test `exit 3`;
        } catch (err) {
            assert.equal(err.code, 3);
        }
    });
    
    it('supports .test() with string values', () => {
        const result2 = sh.test `echo success`;
        assert.equal(result2, true);
        const result1 = sh.test `echo -n`;
        assert.equal(result1, true);
    });
    
    it('supports stdout', () => {
        const result = sh `echo -n hoi; echo hoi`;
        // assert.equal(result, null);
    });
    
    it('supports echo -n', () => {
        const result = sh `echo -n blie`;
        assert.equal(result, "blie");
    });
    
    it('handles ENOENT gracefully', (next) => {
        try {
            shh`dontexistsorry`;
        } catch (e) {
            assert(e.code, e.stack);
            next();
        }
    });
    
    it('supports sh.json', () => {
        const result = sh.json `echo '{"foo":3}'`;
        assert.deepEqual(result, {foo: 3});
    });
    
    it('supports sh.array', () => {
        const result = sh.array`echo "1\n2"`;
        assert.deepEqual(result, [1,2]);
    });
    
    it('supports require("shellsync").sh', () => {
        const sh = require("../src/index").sh;
        sh `:`;
    });
    
    it('supports require("shellsync")', () => {
        const sh = require("../src/index");
        sh `:`;
    });
    
    it('supports import *', () => {
        assert.equal(typeof defaultExportSh, "function");
        defaultExportSh `:`;
    });
    
    it('supports creating new shells using sh()', () => {
        assert.equal(sh.options.input, undefined);
        let sh1 = sh({"input": "1"});
        let sh2 = sh({"input": "2"});
        assert.equal(sh.options.input, undefined);
        assert.equal(sh1.options.input, "1");
        assert.equal(sh2.options.input, "2");
    });
    
    it('supports plain string arguments', () => {
        assert.equal(sh("echo hi" as any), "hi");
    });
    
    it('supports mocks', () => {
        sh.mock("git", `echo fake-git`);
        assert.equal(sh`git`, "fake-git");
    });
    
    it('supports pattern-based mocks', () => {
        sh.mock("git foo", `echo git foo`);
        assert.equal(sh`git foo`, "git foo");
    });
    
    it('supports pattern-based mocks with globs', () => {
        sh.mock("git foo *", `echo git foo stuff`);
        assert.equal(sh`git foo x`, "git foo stuff");
    });
    
    it('supports pattern-based mocks in order of specificity', () => {
        sh.mock("git", `echo git`);
        sh.mock("git *", `echo git x`);
        sh.mock("git ls", `echo git ls`);
        sh.mock("foo bar", `echo foo bar`);
        sh.mock("foo *", `echo foo x`);
        sh.mock("foo", `echo foo`);
        assert.equal(sh`git`, `git`);
        assert.equal(sh`git x`, `git x`);
        assert.equal(sh`git ls`, `git ls`);
        assert.equal(sh`foo bar`, `foo bar`);
        assert.equal(sh`foo x`, `foo x`);
        assert.equal(sh`foo`, `foo`);
    });

    it("supports unmock(mock)", () => {
        sh.mock("echo hello", "echo mock-1");
        sh.mock("echo *", "echo mock-2");
        assert.equal(sh`echo hello`, "mock-1");
        sh.unmock("echo *");
        assert.equal(sh`echo hello`, "hello");
        assert.equal(sh`echo bye`, "bye");
    });

    it("supports unmock(mock) with shared state between sh and shh", () => {
        sh.mock("echo *", "echo mock-1");
        assert.equal(shh`echo hello`, "mock-1");
        sh.unmock("echo *");
        assert.equal(shh`echo hello`, "hello");
    });

    it("supports unmock(mock) with mockAllCommand()", () => {
        sh.mockAllCommands();
        sh.unmock("echo *");
        assert.equal(sh`echo hello`, "hello");
    });
    
    it('only captures specific patterns for mocks', () => {
        sh.mock("pwd mocked", `echo mocked`);
        assert.equal(sh`cd /; pwd`, "/");
        assert.equal(sh`cd /; pwd mocked`, "mocked");
    });
    
    it('supports partial patterns for mocks', () => {
        sh.mock("pwd mocked *", `echo mocked`);
        assert.equal(sh`cd /; pwd mocked bla bla`, "mocked");
    });
    
    it('supports $1 in mocks', () => {
        sh.mock("git *", `echo git-$1`);
        assert.equal(sh`git status`, "git-status");
    });
    
    it('shares mocks between sh and shh', () => {
        sh.mock("git *", `echo git-$1`);
        assert.equal(shh`git status`, "git-status");
    });
    
    it('supports glob-based mocks', () => {
        sh.mock("git *");
        assert.equal(sh`git status`, "");
    });
    
    it('supports calling mocked commands from mocks', () => {
        sh.mock("echo *", "echo mocked-echo");
        assert.equal(sh`echo hello`, "mocked-echo");
    });
    
    it('fails when trying to use a regex in mocks', (next) => {
        try {
            sh.mock("echo .*", "echo mocked-echo");
        } catch (e) {
            next();
        }
    });
    
    it('fails on mocks patterns that start with a *', (next) => {
        try {
            sh.mock("* echo *", "echo asterisks much");
        } catch (e) {
            next();
        }
    });
    
    it('supports mocks that use return 1', (next) => {
        sh.mock("foo", "return 1");
        try {
            sh`foo`;
        } catch (e) {
            next();
        }
    });
    
    it('supports mocks that use exit 1', (next) => {
        sh.mock("foo", "exit 1");
        try {
            sh`foo`;
        } catch (e) {
            next();
        }
    });
    
    it('supports mocks for command -v', () => {
        sh.mock("command -v curl", "echo ok");
        assert.equal(sh`command -v curl`, "ok");
    });
    
    it('supports an edge-case mocks with printf', () => {
        sh.mock("printf *", "exit 1");
        assert.equal(sh`echo ok`, "ok");
    });
    
    it('supports an edge-case mocks with printf in dash', () => {
        sh.options.shell = "dash";
        sh.mock("printf *", "exit 1");
        assert.equal(sh`echo ok`, "ok");
    });
    
    it('disallows mocking exit', (next) => {
        try {
            sh.mock("exit 1", "exit 0");
        } catch {
            next();
        }
    });

    it("can keep track of calls to mocks", () => {
        let mockHello = sh.mock("hello");
        let mockBye = sh.mock("bye");
        assert.equal(mockHello.called, 0);
        sh`hello`;
        assert.equal(mockHello.called, 1);
        sh`hello; bye; hello`;
        assert.equal(mockHello.called, 3);
        assert.equal(mockBye.called, 1);
    });

    it("allows replacing existing mocks", () => {
        let mock1 = sh.mock("hello");
        let mock2 = sh.mock("hello");
        sh`hello`;
        assert.equal(mock1.called, 0);
        assert.equal(mock2.called, 1);
    });
    
    it('supports ssh', () => {
        shh`echo silence is gold`;
    });
    
    it('supports options.debug', () => {
        sh.options.debug = true;
        sh`echo "let's get loud"`;
        sh.options.debug = false;
    });
    
    it('supports options.debug for sh', () => {
        sh.options.debug = true;
        shh`echo "let's get loud"; echo "like, very loud">&2`;
        sh.options.debug = false;
    });
    
    it('reports syntax errors', (next) => {
        try {
            sh`echo let's get errors`;
        } catch (e) {
            assert(e.code === 1 || e.code === 2);
            assert(e.message, "AssertionError [ERR_ASSERTION]: Syntax error in command: `echo let's get errors`"
                + "/bin/bash: line 1: unexpected EOF while looking for matching `''"
                + "/bin/bash: line 2: syntax error: unexpected end of file");
            next()
        }
    });
    
    it('reports syntax errors for shh', (next) => {
        try {
            shh`echo let's get errors`;
        } catch (e) {
            assert(e.code === 1 || e.code === 2);
            assert(e.message, "AssertionError [ERR_ASSERTION]: Syntax error in command: `echo let's get errors`"
                + "/bin/bash: line 1: unexpected EOF while looking for matching `''"
                + "/bin/bash: line 2: syntax error: unexpected end of file");
            next()
        }
    });
    
    it('reports syntax errors for shh.json', (next) => {
        try {
            shh.json`echo let's get errors`;
        } catch (e) {
            assert(e.code === 1 || e.code === 2);
            assert(e.message, "AssertionError [ERR_ASSERTION]: Syntax error in command: `echo let's get errors`"
                + "/bin/bash: line 1: unexpected EOF while looking for matching `''"
                + "/bin/bash: line 2: syntax error: unexpected end of file");
            next()
        }
    });
    
    it('reports syntax errors for mocks early at declaration time', (next) => {
        try {
            sh.mock("json", `echo {"method:"foo","params":"ola"}`);
        } catch (e) {
            assert(e.message.match(/unexpected EOF/), e.message);
            next()
        }
    });

    it("supports sh without any arguments", () => {
        const shell = sh();
        shell`:`;
    });

    it("supports standard input", () => {
        const input = "hello";
        const output = sh({input})`cat`;
        assert.equal(output, input);
    });

    it("supports standard input with read", () => {
        const input = "hello";
        const output = sh({input})`read -p "prompt"; echo $REPLY`;
        assert.equal(output, input);
    })

    // Fails on GNU bash 4
    it.skip("supports standard input with read and handleSignals()", () => {
        sh.handleSignals();
        const input = "hello";
        const output = sh({input})`read -p "prompt "; echo $REPLY`;
        assert.equal(output, input);
    });

    it("supports standard input for shh", () => {
        const input = "hello";
        const output = shh({input})`cat`;
        assert.equal(output, input);
    });

    it("supports standard input for shh", () => {
        const input = "hello";
        const output: string = shh({input})`cat`;
        assert.equal(output, input);
    });
    
    it("supports non-zero exit codes for shh", (next) => {
        try {
            shh`!this should fail`;
        } catch (e) {
            next();
        }
    });
    
    it("supports non-zero exit codes with handleSignals()", (next) => {
        try {
            sh.handleSignals();
            shh`this should fail`;
        } catch (e) {
            next();
        }
    });

    it("has a large maxBuffer", () => {
        const size = 5 * 1024 * 1024;
        const output = sh`printf "%${size}s"`;
        assert.equal(output.length, size);
    });

    it("has sh.out and shh.out functions", () => {
        sh.out``;
        shh.out``;
    });

    it("supports dash", () => {
        sh.options.shell = "dash";
        const output = sh`echo works`;
        sh`echo still works`;
        assert.equal(output, "works");
    });

    it("supports dash with mocks", () => {
        sh.options.shell = "dash";
        sh.mock("ping", "echo pong");
        const output = sh`ping`;
        assert.equal(output, "pong");
    });

    it("supports dash with handleSignals()", () => {
        sh.handleSignals();
        sh.options.shell = "dash";
        const output = sh`echo works`;
        sh`echo still works`;
        assert.equal(output, "works");
    });

    it("supports zsh", () => {
        sh.options.shell = "/bin/zsh";
        const output = sh`echo works`;
        sh`echo still works`;
        assert.equal(output, "works");
    });

    it("supports zsh with mocks", () => {
        sh.options.shell = "/bin/zsh";
        sh.mock("ping", "echo pong");
        const output = sh`ping`;
        assert.equal(output, "pong");
    });

    it("supports zsh with handleSignals()", () => {
        sh.handleSignals();
        sh.options.shell = "/bin/zsh";
        const output = sh`echo works`;
        sh`echo still works`;
        assert.equal(output, "works");
    });

    it("uses console.log for echo``", (next) => {
        console.log = (output: string) => {
            console.log = consoleLog;
            assert.equal(output, "hello")
            next();
        };
        sh.echo`hello`;
    });

    it("supports mocking for echo``", (next) => {
        sh.mock("echo *", "return 1");
        try {
            sh.echo`hello`;
        } catch {
            next();
        }
    });

    it("supports mocking [ -e ... ]", () => {
        sh.mock("[ -e *", "echo it exists, trust me");
        assert.equal(sh`[ -e foo.txt ]`, "it exists, trust me");
    });

    it("correctly quotes for echo``", (next) => {
        console.log = (output: string) => {
            console.log = consoleLog;
            assert.equal(output, "it's all good")
            next();
        };
        sh.echo`it's all good`;
    });

    it("prefers locally installed executables", () => {
        let p = process.env.path;
        process.env.path = "/usr/bin";
        let tsc = sh`which tsc`;
        assert.equal(tsc, path.resolve(__dirname, "../node_modules/.bin/tsc"));
        process.env.path = p;
    });
});

describe("#mockAllCommands", () => {
    afterEach(() => {
        sh.options.debug = false;
        sh.unmockAllCommands();
        sh.options.stdio = stdioDefault;
        console.log = consoleLog;
        console.error = consoleError;
    });

    it("throws for unmocked commands", (next) => {
        sh.mockAllCommands();
        try {
            sh`ls`;
        } catch {
            next();
        }
    });

    it("throws for unmocked spawns", (next) => {
        sh.mockAllCommands();
        try {
            sh`/bin/ls`;
        } catch (e) {
            assert.equal(e.message, "No mock for external command. To mock this command, use 'command /bin/ls' and create a mock that matches 'command /bin/ls'.\nYou can also use sh.unmock('/bin/ls') to remove the mock for this command.");
            next();
        }
    });

    it("throws for with advice for patterns on unmocked commands", (next) => {
        sh.mockAllCommands();
        try {
            sh`echo foo`;
        } catch (e) {
            assert.equal(e.message, "No mock for command. To mock this command, add a mock for 'echo foo' or a pattern like 'echo *'.\nYou can also use sh.unmock('echo *') to remove the mock for this command.");
            next();
        }
    });

    it("throws for unmocked with sh.test", (next) => {
        sh.mockAllCommands();
        try {
            sh.test`ls`;
        } catch {
            next();
        }
    });

    it("doesn't throw with mocks in place", () => {
        sh.mockAllCommands();
        sh.mock("ls");
        sh`ls`;
    });

    it("supports mocks in subshells", () => {
        sh.mock("bling", "echo bling bling");
        assert.equal(sh`(bling)`, "bling bling");
    });

    it("supports mocks in functions", () => {
        sh.mock("bling", "echo bling bling");
        assert.equal(sh`fn() { bling; }; fn`, "bling bling");
    });

    it("prints minimal output when debug and mocking are used together", (next) => {
        sh.options.debug = true;
        sh.options.stdio = [0, "pipe", "pipe", "pipe", "pipe"];
        console.error = (arg: string) => {
            assert.equal(arg, "+ ls\n+ : mock for ls :");
            next();
        }
        sh.mockAllCommands();
        sh.mock("ls");
        sh`ls`;
    });

    it("supports multiple subsequent mocked commands", () => {
        sh.mock("pwd")
        sh.mock("ls")
        sh.mockAllCommands();
        sh.out`pwd; ls`;
    });

    it("throws for unmocked commands after properly mocked ones", (next) => {
        sh.mock("pwd")
        sh.mockAllCommands();
        try {
            sh`pwd; ls`;
        } catch (e) {
            assert.equal(e.message, "No mock for command. To mock this command, add a mock for 'ls'.\nYou can also use sh.unmock('ls') to remove the mock for this command.");
            next();
        }
    });

    it("throws when it detects use of subshells", (next) => {
        sh.mockAllCommands();
        try {
            sh.out`( pwd; ls; )`;
        } catch (e) {
            assert.equal(e.message, "Command appears to have a subshell; mockAllCommands() does not support subshells: ( pwd; ls; )");
            next();
        }
    });

    it("throws when unmocked commands are used to the left of a pipe", (next) => {
        sh.mockAllCommands();
        sh.mock("mocked");
        try {
            sh.out`unmocked | mocked`;
        } catch {
            next();
        }
    });

    it("throws when unmocked commands are used to the right of a pipe", (next) => {
        sh.mockAllCommands();
        sh.mock("mocked");
        try {
            sh.out`mocked | unmocked`;
        } catch {
            next();
        }
    });

    it("throws when it detects use of subshell expressions", (next) => {
        sh.mockAllCommands();
        sh.mock("echo *");
        try {
            sh.out`echo $(hello)`;
        } catch (e) {
            assert.equal(e.message, "Command appears to have a subshell; mockAllCommands() does not support subshells: echo $(hello)");
            next();
        }
    });

    it("doesn't throw when there are no subshells", () => {
        sh.mockAllCommands();
        sh.mock("echo *");
        sh`echo '$(echo)'`; // in 'quotes'
        sh`echo "\\$(echo)"`; // after \escape
        let quoted = "`quoted`";
        sh`echo '${quoted}'`; // in 'quotes'
        sh`echo ${quoted}`; // in automatic quotes
    });
})