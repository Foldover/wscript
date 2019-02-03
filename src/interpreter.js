const fs = require('fs');

const parse = require("./parser.js");
const TokenStream = require("./lexer.js");
const InputStream = require("./input-stream.js");

let STACK_LENGTH;
function guard(f, args) {
  if (--STACK_LENGTH < 0) throw new Continuation(f, args);
}
function Continuation(f, args) {
  this.f = f;
  this.args = args;
}
function Execute(f, args) {
  while (true) try {
    STACK_LENGTH = 200;
    return f.apply(null, args);
  } catch (ex) {
    if (ex instanceof Continuation) {
      f = ex.f;
      args = ex.args;
    } else throw ex;
  }
}

function Environment(parent) {
  this.vars = Object.create(parent ? parent.vars : null);
  this.parent = parent;
}

Environment.prototype = {
  extend: function () {
    return new Environment(this);
  },
  lookup: function (name) {
    let scope = this;
    while (scope) {
      if (Object.prototype.hasOwnProperty.call(scope.vars, name)) {
        return scope;
      }
      scope = scope.parent;
    }
  },
  get: function (name) {
    if (name in this.vars) {
      return this.vars[name];
    }
    throw new Error("Undefined variable " + name);
  },
  set: function (name, value) {
    const scope = this.lookup(name);
    if (!scope && this.parent) {
      throw new Error("Undefined variable " + name);
    }
    return (scope || this).vars[name] = value;
  },
  define: function (name, value) {
    return this.vars[name] = value;
  }
};

function evaluate(expr, env, callback) {
  guard(evaluate, arguments);
  switch (expr.type) {
    case "number":
    case "string":
    case "bool":
      callback(expr.value);
      return;
    case "identifier":
      callback(env.get(expr.value));
      return;
    case "assign":
      if (expr.left.type !== "identifier") {
        throw new Error("Cannot assign to " + JSON.stringify(expr.left));
      }
      evaluate(expr.right, env, function CC(right) {
        guard(CC, arguments);
        callback(env.set(expr.left.value, right));
      });
      return;
    case "binary":
      evaluate(expr.left, env, function CC(left) {
        guard(CC, arguments);
        evaluate(expr.right, env, function CC(right) {
          guard(CC, arguments);
          callback(applyOperator(expr.operator, left, right));
        });
      });
      return;
    case "lambda":
      callback(makeLambda(env, expr));
      return;
    case "if":
      evaluate(expr.cond, env, function CC(cond) {
        guard(CC, arguments);
        if (cond !== false) evaluate(expr.then, env, callback);
        else if (expr.else) evaluate(expr.else, env, callback);
        else callback(false);
      });
      return;
    case "program":
      (function loop(last, i) {
        guard(loop, arguments);
        if (i < expr.program.length) evaluate(expr.program[i], env, function CC(val) {
          guard(CC, arguments);
          loop(val, i + 1);
        }); else {
          callback(last);
        }
      })(false, 0);
      return;
    case "call":
      evaluate(expr.func, env, function CC(func) {
        guard(CC, arguments);
        (function loop(args, i) {
          guard(loop, arguments);
          if (i < expr.args.length) evaluate(expr.args[i], env, function CC(arg) {
            guard(CC, arguments);
            args[i + 1] = arg;
            loop(args, i + 1);
          }); else {
            func.apply(null, args);
          }
        })([callback], 0);
      });
      return;
    case "let":
      (function loop(env, i) {
        guard(loop, arguments);
        if (i < expr.vars.length) {
          let v = expr.vars[i];
          if (v.def) evaluate(v.def, env, function CC(value) {
            guard(CC, arguments);
            let scope = env.extend();
            scope.define(v.name, value);
            loop(scope, i + 1);
          }); else {
            let scope = env.extend();
            scope.define(v.name, false);
            loop(scope, i + 1);
          }
        } else {
          evaluate(expr.body, env, callback);
        }
      })(env, 0);
      return;
    default:
      throw new Error("I don't know how to evaluate " + expr.type);
  }
}

function applyOperator(op, a, b) {
  function num(x) {
    if (typeof x !== "number") {
      throw new Error("Expected number but got " + x);
    }
    return x;
  }

  function div(x) {
    if (num(x) === 0) {
      throw new Error("Divide by zero");
    }
    return x;
  }

  switch (op) {
    case "+":
      return num(a) + num(b);
    case "-":
      return num(a) - num(b);
    case "*":
      return num(a) * num(b);
    case "/":
      return num(a) / div(b);
    case "%":
      return num(a) % div(b);
    case "&&":
      return a !== false && b;
    case "||":
      return a !== false ? a : b;
    case "<":
      return num(a) < num(b);
    case ">":
      return num(a) > num(b);
    case "<=":
      return num(a) <= num(b);
    case ">=":
      return num(a) >= num(b);
    case "==":
      return a === b;
    case "!=":
      return a !== b;
  }
  throw new Error("Can't apply operator " + op);
}

function makeLambda(env, expr) {
  if (expr.name) {
    env = env.extend();
    env.define(expr.name, lambda);
  }

  function lambda(callback) {
    guard(lambda, arguments);
    const names = expr.vars;
    const scope = env.extend();
    for (let i = 0; i < names.length; ++i) {
      scope.define(names[i], i + 1 < arguments.length ? arguments[i + 1] : false);
    }
    evaluate(expr.body, scope, callback);
  }
  return lambda;
}

const globalEnv = new Environment();

globalEnv.define("print", function (callback, txt) {
  console.log(txt);
  callback(false);
});

globalEnv.define("println", function (callback, txt) {
  console.log(txt + "\n");
  callback(false);
});

// some test code here
const code = `
println(let loop (n = 100)
          if n > 0 then n + loop(n - 1)
                   else 0);

let (x = 2, y = x + 1, z = x + y)
  println(x + y + z);

# errors out, the vars are bound to the let body
# print(x + y + z);

let (x = 10) {
  let (x = x * 2, y = x * x) {
    println(x);  ## 20
    println(y);  ## 400
  };
  println(x);  ## 10
};
 `;

process.argv.forEach(function (val, i, arr) {
  if (i < 2) return;
  if (!val.includes('.mc')) {
    throw new Error('Not a Mycel file');
  } else {
    stringifySource(val);
  }
});

function stringifySource(source) {
  let file;
  try {
    file = fs.createReadStream(source);
  } catch (e) {
    throw new Error(e);
  }
  let data = '';
  file.on('data', function (chunk) {
    data += chunk;
  }).on('end', function () {
    const ast = parse(TokenStream(InputStream(data)));
    Execute(evaluate, [ast, globalEnv, function(result) {
      console.log("Program ended with: " + result);
    }]);
  });
}
