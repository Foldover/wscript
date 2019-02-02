"use strict"

function TokenStream(input) {
    let current = null;
    let keywords = " let if then else lambda true false ";
    return {
        next: next,
        peek: peek,
        eof: eof,
        croak: input.croak
    };

    function isKeyword(ch) {
        return keywords.indexOf(" " + ch + " ") >= 0;
    }

    function isDigit(ch) {
        return /[0-9]/i.test(ch);
    }

    function isIdentifierStart(ch) {
        return /[a-z_]/i.test(ch);
    }

    function isIdentifier(ch) {
        return isIdentifierStart(ch) || "?!-<>=0123456789".indexOf(ch) >= 0;
    }

    function isOperator(ch) {
        return "+-*/%=&|<>!".indexOf(ch) >= 0;
    }

    function isPunctuation(ch) {
        return ",;(){}[]".indexOf(ch) >= 0;
    }

    function isWhitespace(ch) {
        return " \t\n".indexOf(ch) >= 0;
    }

    function readWhile(predicate) {
        let str = "";
        while (!input.eof() && predicate(input.peek()))
            str += input.next();
        return str;
    }

    function readNumber() {
        let hasDot = false;
        let number = readWhile(function (ch) {
            if (ch === ".") {
                if (hasDot) return false;
                hasDot = true;
                return true;
            }
            return isDigit(ch);
        });
        return {
            type: "number",
            value: parseFloat(number),
        };
    }

    function readIdentifier() {
        let id = readWhile(isIdentifier);
        return {
            type: isKeyword(id) ? "keyword" : "identifier",
            value: id,
        }
    }

    function readEscaped(end) {
        let escaped = false, str = "";
        input.next();
        while (!input.eof()) {
            let ch = input.next();
            if (escaped) {
                str += ch;
                escaped = false;
            } else if (ch === "\\") {
                escaped = true;
            } else if (ch === end) {
                break;
            } else {
                str += ch;
            }
        }
        return str;
    }

    function readString() {
        return {
            type: "string",
            value: readEscaped('"'),
        }
    }

    function skipComment() {
        readWhile(function (ch) {
            return ch !== "\n";
        });
        input.next();
    }

    function readNext() {
        readWhile(isWhitespace);
        if (input.eof()) return null;
        let ch = input.peek();
        if (ch === "#") {
            skipComment();
            return readNext();
        }
        if (ch === '"') return readString();
        if (isDigit(ch)) return readNumber();
        if (isIdentifierStart(ch)) return readIdentifier();
        if (isPunctuation(ch)) return {
            type: "punctuation",
            value: input.next(),
        };
        if (isOperator(ch)) return {
            type: "operator",
            value: readWhile(isOperator),
        };
        input.croak("Invalid character: " + ch);
    }

    function peek() {
        return current || (current = readNext());
    }

    function next() {
        let token = current;
        current = null;
        return token || readNext();
    }

    function eof() {
        return peek() === null;
    }
}

module.exports = TokenStream;