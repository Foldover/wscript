const FALSE = {
  type: "bool",
  value: false,
};

function parse(input) {
  let PRECEDENCE = {
    "=": 1,
    "||": 2,
    "&&": 3,
    "<": 7, ">": 7, "<=": 7, ">=": 7, "==": 7, "!=": 7,
    "+": 10, "-": 10,
    "*": 20, "/": 20, "%": 20,
  };
  return parseTopLevel();
  function isPunctuation(ch) {
    const token = input.peek();
    return token && token.type === "punctuation" && (!ch || token.value === ch) && token;
  }
  function isKeyword(kw) {
    const token = input.peek();
    return token && token.type === "keyword" && (!kw || token.value === kw) && token;
  }
  function isOperator(op) {
    const token = input.peek();
    return token && token.type === "operator" && (!op || token.valueOf() === op) && token;
  }
  function skipPunctuation(ch) {
    if (isPunctuation(ch)) input.next();
    else input.croak("Expecting punctuation: \"" + ch + "\"");
  }
  function skipKeyword(kw) {
    if (isKeyword(kw)) input.next();
    else input.croak("Expecting keyword: \"" + kw + "\"");
  }
  function skipOperator(op) {
    if (isOperator(op)) input.next();
    else input.croak("Expecting operator: \"" + op + "\"");
  }
  function unexpected() {
    input.croak("Unexpected token: " + JSON.stringify(input.peek()));
  }
  function maybeBinary(left, myPrecedence) {
    const token = isOperator();
    if (token) {
      const otherPrecedence = PRECEDENCE[token.value];
      if (otherPrecedence > myPrecedence) {
        input.next();
        if (token.value === "||" || token.value === "&&") {
          return {
            type: "if",
            cond: left,
            then: maybeBinary(parseAtom(), otherPrecedence),
          }
        } else {
          return maybeBinary({
            type: token.value === "=" ? "assign" : "binary",
            operator: token.value,
            left,
            right: maybeBinary(parseAtom(), otherPrecedence),
          }, myPrecedence);
        }
      }
    }
    return left;
  }
  function delimited(start, stop, separator, parser) {
    let a = [], first = true;
    skipPunctuation(start);
    while (!input.eof()) {
      if (isPunctuation(stop)) break;
      if (first) first = false; else skipPunctuation(separator);
      if (isPunctuation(stop)) break;
      a.push(parser());
    }
    skipPunctuation(stop);
    return a;
  }
  function parseCall(func) {
    return {
      type: "call",
      func,
      args: delimited("(", ")", ",", parseExpression),
    };
  }
  function parseIdentifierName() {
    const name = input.next();
    if (name.type !== "identifier") input.croak("Expecting variable name");
    return name.value;
  }
  function parseIf() {
    skipKeyword("if");
    const cond = parseExpression();
    if (!isPunctuation("{")) skipKeyword("then");
    const then = parseExpression();
    const ret = {
      type: "if",
      cond,
      then,
    };
    if (isKeyword("else")) {
      input.next();
      ret.else = parseExpression();
    }
    return ret;
  }
  function parseLambda() {
    return {
      type: "lambda",
      vars: delimited("(", ")", ",", parseIdentifierName),
      body: parseExpression(),
    };
  }
  function parseBool() {
    return {
      type: "bool",
      value: input.next().value === "true",
    };
  }
  function maybeCall(expr) {
    expr = expr();
    return isPunctuation("(") ? parseCall(expr) : expr;
  }
  function parseAtom() {
    return maybeCall(function () {
      if (isPunctuation("(")) {
        input.next();
        const expr = parseExpression();
        skipPunctuation(")");
        return expr;
      }
      if (isPunctuation("{")) return parseProgram();
      if (isKeyword("if")) return parseIf();
      if (isKeyword("true") || isKeyword("false")) return parseBool();
      if (isKeyword("lambda")) {
        input.next();
        return parseLambda();
      }
      const token = input.next();
      if (token.type === "identifier" || token.type === "number" || token.type ==="string") {
        return token;
      }
      unexpected();
    });
  }
  function parseTopLevel() {
    let program = [];
    while (!input.eof()) {
      program.push(parseExpression());
      if (!input.eof()) skipPunctuation(";");
    }
    return {
      type: "program",
      program
    };
  }
  function parseProgram() {
    const program = delimited("{", "}", ";", parseExpression);
    if (program.length === 0) return FALSE;
    if (program.length === 1) return program[0];
    return {
      type: "program",
      program,
    };
  }
  function parseExpression() {
    return maybeCall(function () {
      return maybeBinary(parseAtom(), 0);
    });
  }
}

module.exports = parse;