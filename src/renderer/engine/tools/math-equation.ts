/**
 * Equation Solving Tool using mathjs
 * Supports symbolic and numeric equation solving
 */
import * as math from 'mathjs'

export type EquationOperation =
  | 'solve'         // Symbolic equation solving
  | 'solve_linear'  // Linear system using matrix
  | 'roots'         // Polynomial roots
  | 'numeric_solve' // Newton-Raphson numerical solving
  | 'inequality'    // Inequality solving
  | 'system'        // System of equations

export interface MathEquationInput {
  operation: EquationOperation
  // Single equation
  equation?: string
  variable?: string
  // Linear system
  matrixA?: number[][]
  vectorB?: number[]
  // Polynomial
  coefficients?: number[]
  // System of equations
  equations?: string[]
  variables?: string[]
  // Numerical solving
  initialGuess?: number
  tolerance?: number
  maxIterations?: number
  // Inequality
  inequality?: string
}

export interface MathEquationResult {
  success: boolean
  result: unknown
  error?: string
}

/**
 * Parse equation string to extract left and right sides
 */
function parseEquation(eq: string): { left: string; right: string } | null {
  const parts = eq.split('=')
  if (parts.length !== 2) return null
  return { left: parts[0].trim(), right: parts[1].trim() }
}

/**
 * Preprocess equation expression to handle common mathematical notation
 */
function preprocessEquationExpression(expr: string): string {
  let processed = expr.trim()

  // Replace π with PI (but be careful not to replace in function names)
  processed = processed.replace(/π/g, 'PI')

  // Replace ** with ^ for uniformity
  processed = processed.replace(/\*\*/g, '^')

  // Handle implicit multiplication like "2x" -> "2*x", "3(t+1)" -> "3*(t+1)"
  // Number followed by variable or parenthesis
  processed = processed.replace(/(\d)([a-zA-Z(])/g, '$1*$2')
  processed = processed.replace(/(\))([a-zA-Z0-9(])/g, '$1*$2')

  // Handle division like 1/t - make sure it's properly parenthesized
  // This helps mathjs parse expressions like "t + 1/t - 4" correctly

  // Replace common function names with mathjs equivalents
  processed = processed.replace(/\barctan\b/g, 'atan')
  processed = processed.replace(/\barcsin\b/g, 'asin')
  processed = processed.replace(/\barccos\b/g, 'acos')
  processed = processed.replace(/\barctanh\b/g, 'atanh')
  processed = processed.replace(/\barcsinh\b/g, 'asinh')
  processed = processed.replace(/\barccosh\b/g, 'acosh')

  // Handle ln -> log
  processed = processed.replace(/\bln\b/g, 'log')

  // Handle sqrt()
  // sqrt is already supported by mathjs

  // Handle factorial notation n! if present
  // This is tricky in equations, so for now we'll just note it
  // processed = processed.replace(/(\d+)!/g, 'factorial($1)')

  return processed
}

/**
 * Newton-Raphson method for numerical root finding
 */
function newtonRaphson(
  expr: math.EvalFunction,
  deriv: math.EvalFunction,
  x0: number,
  tolerance: number,
  maxIter: number
): { root: number; iterations: number } | null {
  const scope: Record<string, number> = {}
  let x = x0

  for (let i = 0; i < maxIter; i++) {
    scope.x = x
    const fx = expr.evaluate(scope) as number
    const fpx = deriv.evaluate(scope) as number

    if (Math.abs(fpx) < 1e-15) {
      // Derivative is zero, try a small perturbation
      x += 0.001
      continue
    }

    const xNew = x - fx / fpx

    if (Math.abs(xNew - x) < tolerance) {
      return { root: xNew, iterations: i + 1 }
    }

    x = xNew
  }

  return null
}

/**
 * Bisection method as fallback
 */
function bisection(
  expr: math.EvalFunction,
  a: number,
  b: number,
  tolerance: number,
  maxIter: number
): number | null {
  const scope: Record<string, number> = {}

  scope.x = a
  const fa = expr.evaluate(scope) as number
  scope.x = b
  const fb = expr.evaluate(scope) as number

  if (fa * fb > 0) return null

  for (let i = 0; i < maxIter; i++) {
    const c = (a + b) / 2
    scope.x = c
    const fc = expr.evaluate(scope) as number

    if (Math.abs(fc) < tolerance || (b - a) / 2 < tolerance) {
      return c
    }

    if (fa * fc < 0) {
      b = c
    } else {
      a = c
    }
  }

  return (a + b) / 2
}

/**
 * Find multiple roots by scanning intervals
 */
function findAllRoots(
  expr: math.EvalFunction,
  _deriv: math.EvalFunction,
  range: [number, number],
  tolerance: number,
  maxIter: number
): number[] {
  const roots: number[] = []
  const step = (range[1] - range[0]) / 100
  const scope: Record<string, number> = {}

  let lastSign: number | null = null
  let lastX = range[0]

  for (let x = range[0]; x <= range[1]; x += step) {
    scope.x = x
    const fx = expr.evaluate(scope) as number
    const sign = Math.sign(fx)

    if (lastSign !== null && sign !== lastSign) {
      // Sign change detected, find root in this interval
      const root = bisection(expr, lastX, x, tolerance, maxIter)
      if (root !== null) {
        // Check if this root is already found
        const isDuplicate = roots.some(r => Math.abs(r - root) < tolerance * 10)
        if (!isDuplicate) {
          roots.push(root)
        }
      }
    }

    lastSign = sign
    lastX = x
  }

  return roots
}

/**
 * Solve linear system Ax = b using LU decomposition
 */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = A.length
  if (n === 0 || A[0].length !== n || b.length !== n) return null

  try {
    const matrixA = math.matrix(A) as math.Matrix
    const result = math.lusolve(matrixA, b) as math.Matrix
    // lusolve 返回列向量矩阵 [[x1], [x2], ...]，需要展平
    const arr = result.toArray() as unknown as number[][]
    return arr.map(row => {
      if (Array.isArray(row) && row.length > 0) {
        return typeof row[0] === 'number' ? row[0] : 0
      }
      return typeof row === 'number' ? row : 0
    })
  } catch {
    return null
  }
}

/**
 * Find polynomial roots using numerical methods
 */
function findPolynomialRoots(coefficients: number[]): number[] {
  if (coefficients.length < 2) return []

  const degree = coefficients.length - 1

  // For low degree polynomials, use direct formulas
  if (degree === 1) {
    return [-coefficients[1] / coefficients[0]]
  }

  if (degree === 2) {
    const [a, b, c] = coefficients
    const discriminant = b * b - 4 * a * c
    if (discriminant < 0) {
    // Complex roots - return real part only
    return []
  }
    const sqrtD = Math.sqrt(discriminant)
    return [(-b + sqrtD) / (2 * a), (-b - sqrtD) / (2 * a)]
  }

  // For higher degrees, use numerical methods
  // Find roots by scanning for sign changes
  const roots: number[] = []
  const range = 100
  const step = 0.5

  for (let x = -range; x <= range; x += step) {
    let y = 0
    for (let i = 0; i <= degree; i++) {
      y += coefficients[i] * Math.pow(x, degree - i)
    }

    let yNext = 0
    for (let i = 0; i <= degree; i++) {
      yNext += coefficients[i] * Math.pow(x + step, degree - i)
    }

    if (y * yNext < 0) {
      // Sign change - use bisection to find root
      const root = bisectionPoly(coefficients, x, x + step, 1e-10, 100)
      if (root !== null && !roots.some(r => Math.abs(r - root) < 1e-6)) {
        roots.push(root)
      }
    }
  }

  return roots
}

/**
 * Evaluate polynomial at x
 */
function evalPoly(coeffs: number[], x: number): number {
  let result = 0
  const degree = coeffs.length - 1
  for (let i = 0; i <= degree; i++) {
    result += coeffs[i] * Math.pow(x, degree - i)
  }
  return result
}

/**
 * Bisection for polynomial
 */
function bisectionPoly(coeffs: number[], a: number, b: number, tol: number, maxIter: number): number | null {
  const fa = evalPoly(coeffs, a)
  const fb = evalPoly(coeffs, b)

  if (fa * fb > 0) return null

  for (let i = 0; i < maxIter; i++) {
    const c = (a + b) / 2
    const fc = evalPoly(coeffs, c)

    if (Math.abs(fc) < tol || (b - a) / 2 < tol) {
      return c
    }

    if (fa * fc < 0) {
      b = c
    } else {
      a = c
    }
  }

  return (a + b) / 2
}

export function mathEquation(input: MathEquationInput): MathEquationResult {
  try {
    const {
      operation,
      equation,
      variable = 'x',
      matrixA,
      vectorB,
      coefficients,
      equations,
      variables,
      initialGuess = 0,
      tolerance = 1e-10,
      maxIterations = 100
    } = input

    // 验证 operation 参数
    if (!operation) {
      return {
        success: false,
        result: null,
        error: '需要指定 operation 参数。可用操作: solve, solve_linear, roots, numeric_solve, inequality, system'
      }
    }

    switch (operation) {
      case 'solve': {
        if (!equation) {
          return { success: false, result: null, error: '需要 equation' }
        }

        // Parse equation
        const parsed = parseEquation(equation)
        if (!parsed) {
          return { success: false, result: null, error: '方程格式错误，需要等式形式如 "x^2 - 5*x + 6 = 0"' }
        }

        try {
          // Preprocess both sides of the equation
          const leftProcessed = preprocessEquationExpression(parsed.left)
          const rightProcessed = preprocessEquationExpression(parsed.right)

          // Create expression: left - right = 0
          const expr = `${leftProcessed} - (${rightProcessed})`

          // Parse and compile
          const parsedExpr = math.parse(expr)
          const compiled = parsedExpr.compile()
          const deriv = math.derivative(parsedExpr, variable)
          const compiledDeriv = deriv.compile()

          // Find roots using numerical methods
          const roots = findAllRoots(compiled, compiledDeriv, [-100, 100], tolerance, maxIterations)

          if (roots.length > 0) {
            return {
              success: true,
              result: {
                equation,
                variable,
                solutions: roots.map(r => parseFloat(r.toPrecision(10))),
                count: roots.length,
                method: '数值求解'
              }
            }
          }

          return { success: false, result: null, error: '未找到解（可能无实数解）' }
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e)
          return { success: false, result: null, error: `无法解析或求解方程: ${errorMsg}` }
        }
      }

      case 'solve_linear': {
        if (!matrixA || !vectorB) {
          return { success: false, result: null, error: '需要 matrixA 和 vectorB' }
        }

        const solution = solveLinearSystem(matrixA, vectorB)
        if (!solution) {
          return { success: false, result: null, error: '无法求解线性方程组（可能无解或无穷多解）' }
        }

        return {
          success: true,
          result: {
            type: '线性方程组',
            matrixA,
            vectorB,
            solution,
            formatted: solution.map((v, i) => `x${i + 1} = ${v.toFixed(10)}`).join('\n')
          }
        }
      }

      case 'roots': {
        if (!coefficients || coefficients.length < 2) {
          return { success: false, result: null, error: '需要 coefficients（至少2个系数）' }
        }

        const roots = findPolynomialRoots(coefficients)

        if (roots.length === 0) {
          return { success: false, result: null, error: '无法找到多项式的根' }
        }

        // Format polynomial
        const degree = coefficients.length - 1
        const terms: string[] = []
        for (let i = 0; i <= degree; i++) {
          const coef = coefficients[i]
          const power = degree - i
          if (coef === 0) continue

          let term = ''
          if (coef >= 0 && terms.length > 0) term += '+ '

          if (power === 0) {
            term += coef
          } else if (power === 1) {
            term += `${coef === 1 ? '' : coef === -1 ? '-' : coef}x`
          } else {
            term += `${coef === 1 ? '' : coef === -1 ? '-' : coef}x^${power}`
          }
          terms.push(term)
        }

        return {
          success: true,
          result: {
            polynomial: terms.join(' ') || '0',
            coefficients,
            degree,
            roots,
            count: roots.length
          }
        }
      }

      case 'numeric_solve': {
        if (!equation) {
          return { success: false, result: null, error: '需要 equation' }
        }

        const parsed = parseEquation(equation)
        if (!parsed) {
          return { success: false, result: null, error: '方程格式错误' }
        }

        try {
          // Preprocess both sides of the equation
          const leftProcessed = preprocessEquationExpression(parsed.left)
          const rightProcessed = preprocessEquationExpression(parsed.right)

          // Create expression: left - right = 0
          const expr = `${leftProcessed} - (${rightProcessed})`

          const parsedExpr = math.parse(expr)
          const compiled = parsedExpr.compile()
          const deriv = math.derivative(parsedExpr, variable)
          const compiledDeriv = deriv.compile()

          // Try Newton-Raphson first
          const nrResult = newtonRaphson(compiled, compiledDeriv, initialGuess, tolerance, maxIterations)

          if (nrResult) {
            return {
              success: true,
              result: {
                method: 'Newton-Raphson',
                equation,
                variable,
                root: nrResult.root,
                iterations: nrResult.iterations,
                initialGuess
              }
            }
          }

          // Fallback: scan for multiple roots
          const roots = findAllRoots(compiled, compiledDeriv, [-100, 100], tolerance, maxIterations)

          if (roots.length > 0) {
            return {
              success: true,
              result: {
                method: '数值扫描',
                equation,
                variable,
                roots,
                count: roots.length
              }
            }
          }

          return { success: false, result: null, error: '未找到解' }
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e)
          return { success: false, result: null, error: `数值求解错误: ${errorMsg}` }
        }
      }

      case 'inequality': {
        const { inequality } = input
        if (!inequality) {
          return { success: false, result: null, error: '需要 inequality' }
        }

        // Try to solve inequality symbolically
        try {
          // Preprocess the inequality expression
          const processed = preprocessEquationExpression(inequality)
          const parsed = math.parse(processed)
          const simplified = math.simplify(parsed)

          return {
            success: true,
            result: {
              inequality,
              simplified: simplified.toString(),
              note: '请使用 numeric_solve 求得边界点后判断区间'
            }
          }
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e)
          return { success: false, result: null, error: `无法解析不等式: ${errorMsg}` }
        }
      }

      case 'system': {
        if (!equations || equations.length === 0) {
          return { success: false, result: null, error: '需要 equations 数组' }
        }

        const vars = variables || ['x', 'y', 'z'].slice(0, equations.length)

        try {
          // For linear systems, convert to matrix form
          // This is a simplified approach - real symbolic solving is complex
          const result: Record<string, number> = {}

          // Try numerical approach for 2x2 systems
          if (equations.length === 2 && vars.length === 2) {
            // Use Newton's method for system of equations
            let x = 0, y = 0
            const maxIterLocal = 100

            for (let iter = 0; iter < maxIterLocal; iter++) {
              const scope: Record<string, number> = { x, y }

              // Parse and evaluate each equation
              const values: number[] = []
              const jacobian: number[][] = [[0, 0], [0, 0]]

              for (let i = 0; i < 2; i++) {
                const parsed = parseEquation(equations[i])
                if (!parsed) throw new Error(`方程格式错误: ${equations[i]}`)

                // Preprocess both sides
                const leftProcessed = preprocessEquationExpression(parsed.left)
                const rightProcessed = preprocessEquationExpression(parsed.right)

                const expr = `${leftProcessed} - (${rightProcessed})`
                const parsedExpr = math.parse(expr)
                const compiled = parsedExpr.compile()
                values.push(compiled.evaluate(scope) as number)

                // Partial derivatives
                const dxExpr = math.derivative(parsedExpr, 'x')
                const dyExpr = math.derivative(parsedExpr, 'y')
                jacobian[i][0] = dxExpr.compile().evaluate(scope) as number
                jacobian[i][1] = dyExpr.compile().evaluate(scope) as number
              }

              // Solve 2x2 linear system for delta
              const det = jacobian[0][0] * jacobian[1][1] - jacobian[0][1] * jacobian[1][0]
              if (Math.abs(det) < 1e-15) break

              const dx = (values[0] * jacobian[1][1] - values[1] * jacobian[0][1]) / det
              const dy = (jacobian[0][0] * values[1] - jacobian[1][0] * values[0]) / det

              x -= dx
              y -= dy

              if (Math.abs(dx) < 1e-10 && Math.abs(dy) < 1e-10) {
                result[vars[0]] = parseFloat(x.toPrecision(10))
                result[vars[1]] = parseFloat(y.toPrecision(10))
                return {
                  success: true,
                  result: {
                    equations,
                    variables: vars,
                    solution: result,
                    method: '牛顿迭代法'
                  }
                }
              }
            }
          }

          return { success: false, result: null, error: '无法求解方程组（请尝试 solve_linear 用于线性方程组）' }
        } catch (e) {
          return { success: false, result: null, error: `方程组求解错误: ${(e as Error).message}` }
        }
      }

      default:
        return { success: false, result: null, error: `未知操作: ${operation}` }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, result: null, error: `方程求解错误: ${message}` }
  }
}
