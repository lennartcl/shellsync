import * as assert from "assert";
import {quote, unquoted} from "./index";
import defaultExportSh from "./index";
import {sh} from "./index";
import {shh} from "./index";

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
        const escaped = quote`foo ${false} ${undefined as any} ${0}`;
        assert.equal(escaped, `foo false '' 0`);
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
});

describe('#createShell', () => {
    beforeEach(() => {
        sh.mockRestore();
    });
    
    it('can echo', () => {
        const hoi = `"hoi"`;
        const result = sh.val `echo ${hoi}`;
        assert.equal(result, `"hoi"`);
    });

    it('respects cwd', () => {
        sh.options.cwd = "/";
        const result = sh.val `echo $PWD`;
        assert.equal(result, `/`);
    });
    
    it('respects cd', () => {
        sh.options.cwd = "/";
        sh `cd tmp`;
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
        assert.equal(result2, "success");
        const result1 = sh.test `echo -n`;
        assert.equal(result1, true);
    });
    
    it('supports stdout', () => {
        const result = sh `echo -n hoi; echo hoi`;
        // assert.equal(result, null);
    });
    
    it('supports echo -n', () => {
        const result = sh.val `echo -n blie`;
        assert.equal(result, "blie");
    });
    
    it('handles ENOENT gracefully', () => {
        try {
            sh.val `dontexistsorry`;
        } catch (e) {
            assert(e.code, e.stack);
            return;
        }
        throw new Error("Exception expected");
    });
    
    it('supports sh.json', () => {
        const result = sh.json `echo '{"foo":3}'`;
        assert.deepEqual(result, {foo: 3});
    });
    
    it('supports sh.vals', () => {
        const result = sh.vals`echo "1\n2"`;
        assert.deepEqual(result, [1,2]);
    });
    
    it('supports require("shellsync").sh', () => {
        const sh = require("./index").sh;
        sh `:`;
    });
    
    it('supports require("shellsync")', () => {
        const sh = require("./index");
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
        assert.equal(sh.val("echo hi" as any), "hi");
    });
    
    it('supports mocks', () => {
        sh.mock("git", `echo fake-git`);
        assert.equal(sh.val`git`, "fake-git");
    });
    
    it('supports pattern-based mocks', () => {
        sh.mock("git foo", `echo git foo`);
        assert.equal(sh.val`git foo`, "git foo");
    });
    
    it('supports pattern-based mocks in order of specificity', () => {
        sh.mock("git", `echo git`);
        sh.mock("git *", `echo git x`);
        sh.mock("git ls", `echo git ls`);
        sh.mock("foo bar", `echo foo bar`);
        sh.mock("foo *", `echo foo x`);
        sh.mock("foo", `echo foo`);
        assert.equal(sh.val`git`, `git`);
        assert.equal(sh.val`git x`, `git x`);
        assert.equal(sh.val`git ls`, `git ls`);
        assert.equal(sh.val`foo bar`, `foo bar`);
        assert.equal(sh.val`foo x`, `foo x`);
        assert.equal(sh.val`foo`, `foo`);
    });
    
    it('only captures specific patterns for mocks', () => {
        sh.mock("pwd mocked", `echo mocked`);
        assert.equal(sh.val`cd /; pwd`, "/");
        assert.equal(sh.val`cd /; pwd mocked`, "mocked");
    });
    
    it('supports partial patterns for mocks', () => {
        sh.mock("pwd mocked *", `echo mocked`);
        assert.equal(sh.val`cd /; pwd mocked bla bla`, "mocked");
    });
    
    it('supports $1 in mocks', () => {
        sh.mock("git *", `echo git-$1`);
        assert.equal(sh.val`git status`, "git-status");
    });
    
    it('supports glob-based mocks', () => {
        sh.mock("git *");
        assert.equal(sh.val`git status`, "");
    });
    
    it('supports calling mocked commands from mocks', () => {
        sh.mock("echo *", "echo mocked-echo");
        assert.equal(sh.val`echo hello`, "mocked-echo");
    });
    
    it('fails when trying to use a regex in mocks', (next) => {
        try {
            sh.mock("echo .*", "echo mocked-echo");
        } catch (e) {
            next();
        }
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
            sh.val`echo let's get errors`;
        }
        catch (e) {
            assert.equal(e.code, 2);
            assert(e.message.match(/Error: Process exited with error code 2/), e.message);
            assert(e.message.match(/unexpected EOF/), e.message);
            next()
        }
    });
    
    it('reports syntax errors for sh.json', (next) => {
        try {
            sh.json`echo let's get json`;
        }
        catch (e) {
            assert.equal(e.code, 2);
            assert(e.message.match(/Error: Process exited with error code 2/), e.message);
            assert(e.message.match(/unexpected EOF/), e.message);
            next()
        }
    });
    
    it('reports syntax errors for mocks early at declaration time', (next) => {
        try {
            sh.mock("json", `echo {"method:"foo","params":"ola"}`);
        }
        catch (e) {
            next()
        }
    });

    it("supports sh without any arguments", () => {
        const shell = sh();
        shell.val`:`;
    });

    it("supports standard input", () => {
        const input = "hello";
        const output = sh({input}).val`cat`;
        assert.equal(output, input);
    });

    it("supports standard input with read", () => {
        const input = "hello";
        const output = sh({input}).val`read -p "prompt"; echo $REPLY`;
        assert.equal(output, input);
    })

    it("supports standard input with read and handleSignals()", () => {
        sh.handleSignals();
        const input = "hello";
        const output = sh({input}).val`read -p "prompt "; echo $REPLY`;
        assert.equal(output, input);
    });

    it("supports standard input for shh", () => {
        const input = "hello";
        const output = shh({input}).val`cat`;
        assert.equal(output, input);
    });
});