cons = lambda(a, b) lambda(f) f(a, b);
car = lambda(cell) cell(lambda(a, b) a);
cdr = lambda(cell) cell(lambda(a, b) b);
NIL = lambda(f) f(NIL, NIL);
set-car! = lambda(cell, val) cell("set", 0, val);
set-cdr! = lambda(cell, val) cell("set", 1, val);

printRange = lambda(a, b) {
                 print(a);
                 if a < b then printRange(a + 1, b);
                 };
printRange(1, 10);

println(let loop (n = 100)
            if n > 0 then n + loop(n - 1)
            else 0);

vector = lambda(x, y) cons(x, y);
v1 = vector(0, 1);
print(car(v1));

fib = lambda(n) if n < 2 then n else fib(n - 1) + fib(n - 2);
println(fib(20));