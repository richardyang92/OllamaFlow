/**
 * Calculus Tool using mathjs
 * Supports differentiation, integration, limits, and symbolic operations
 */
import * as math from 'mathjs'

// 直接使用 mathjs，不创建自定义实例
const customMath = math

/**
 * 对表达式进行预处理，将 arctan/arcsin/arccos 等转换为 mathjs 支持的格式
 */
function preprocessCalculusExpression(expr: string): string {
  let processed = expr.trim()

  // 将 arc* 前缀的函数转换为 mathjs 内置函数名
  // arctan -> atan, arcsin -> asin, arccos -> acos
  // arctanh -> atanh, arcsinh -> asinh, arccosh -> acosh
  const replacements: [string, string][] = [
    ['arctan', 'atan'],
    ['arcsin', 'asin'],
    ['arccos', 'acos'],
    ['arctanh', 'atanh'],
    ['arcsinh', 'asinh'],
    ['arccosh', 'acosh'],
  ]

  for (const [from, to] of replacements) {
    // 使用正则表达式匹配函数名（避免替换部分匹配）
    // 匹配单词边界 + 函数名 + 左括号
    const regex = new RegExp(`\\b${from}\\s*\\(`, 'g')
    processed = processed.replace(regex, `${to}(`)
  }

  return processed
}

/**
 * 尝试计算导数，如果失败则提供替代方案
 */
function tryDerivative(
  parsed: math.MathNode,
  variable: string
): { success: boolean; result?: math.MathNode; error?: string } {
  try {
    const derivative = customMath.derivative(parsed, variable)
    return { success: true, result: derivative }
  } catch (e) {
    const errorMsg = (e as Error).message

    // 检查是否是未知函数的错误
    if (errorMsg.includes('the function') && errorMsg.includes('is not supported')) {
      // 尝试提取函数名
      const match = errorMsg.match(/function\s+"?(\w+)"?\s+in\s+derivative/)
      if (match) {
        const fnName = match[1]
        return {
          success: false,
          error: `mathjs 不支持函数 "${fnName}" 的符号求导。

支持的函数包括:
- 三角函数: sin, cos, tan
- 反三角函数: asin, acos, atan, asinh, acosh, atanh (或 arcsin, arccos, arctan 等)
- 指数/对数: exp, log, log10, sqrt
- 其他: abs, sign

建议：
1. 使用 evaluate_derivative 操作在特定点数值计算导数
2. 将复杂函数分解为已知函数的组合`
        }
      }
    }

    return {
      success: false,
      error: `求导错误: ${errorMsg}`
    }
  }
}

export type CalculusOperation =
  | 'derivative'         // Symbolic derivative
  | 'evaluate_derivative' // Evaluate derivative at a point
  | 'integral'           // Symbolic indefinite integral
  | 'evaluate_integral'  // Definite integral
  | 'limit'              // Numerical limit approximation
  | 'simplify'           // Simplify expression
  | 'taylor'             // Taylor series expansion
  | 'nth_derivative'     // n-th derivative
  | 'expand'             // Expand expression
  | 'factor'             // Factor expression

export interface MathCalculusInput {
  operation: CalculusOperation
  expression: string
  variable?: string
  point?: number
  lowerLimit?: number
  upperLimit?: number
  order?: number  // For nth_derivative and taylor
  terms?: number  // For taylor series
  approach?: 'left' | 'right' | 'both'  // For limit
}

export interface MathCalculusResult {
  success: boolean
  result: string | number | object
  error?: string
}

/**
 * Numerical limit approximation using Richardson extrapolation
 */
function numericalLimit(
  expr: math.EvalFunction,
  variable: string,
  point: number,
  approach: 'left' | 'right' | 'both' = 'both'
): number | string {
  const h_values = [1e-1, 1e-2, 1e-3, 1e-4, 1e-5, 1e-6, 1e-7, 1e-8]
  const scope: Record<string, number> = {}

  const evaluateAt = (x: number): number | null => {
    try {
      scope[variable] = x
      const result = expr.evaluate(scope)
      if (typeof result === 'number' && Number.isFinite(result)) {
        return result
      }
      return null
    } catch {
      return null
    }
  }

  const approximations: number[] = []

  for (const h of h_values) {
    let leftVal: number | null = null
    let rightVal: number | null = null

    if (approach === 'left' || approach === 'both') {
      leftVal = evaluateAt(point - h)
    }
    if (approach === 'right' || approach === 'both') {
      rightVal = evaluateAt(point + h)
    }

    if (approach === 'both' && leftVal !== null && rightVal !== null) {
      approximations.push((leftVal + rightVal) / 2)
    } else if (approach === 'left' && leftVal !== null) {
      approximations.push(leftVal)
    } else if (approach === 'right' && rightVal !== null) {
      approximations.push(rightVal)
    }
  }

  if (approximations.length === 0) {
    return '无法计算极限（可能不存在或表达式无效）'
  }

  // Check for convergence
  const lastFew = approximations.slice(-4)
  const avg = lastFew.reduce((a, b) => a + b, 0) / lastFew.length
  const variance = lastFew.reduce((sum, val) => sum + (val - avg) ** 2, 0) / lastFew.length

  if (variance > 1) {
    return '极限可能不存在或震荡'
  }

  // Return the best approximation
  const result = approximations[approximations.length - 1]
  return parseFloat(result.toPrecision(10))
}

/**
 * Compute Taylor series expansion
 */
function taylorExpansion(
  expr: math.MathNode,
  variable: string,
  center: number,
  terms: number
): string {
  const scope: Record<string, number> = {}
  let currentExpr = expr
  let result = ''
  let factorial = 1

  for (let n = 0; n < terms; n++) {
    // Evaluate at center
    scope[variable] = center
    let coeff: number
    try {
      coeff = currentExpr.evaluate(scope) as number
    } catch {
      break
    }

    if (!Number.isFinite(coeff)) {
      break
    }

    factorial = n === 0 ? 1 : factorial * n
    const normalizedCoeff = coeff / factorial

    if (Math.abs(normalizedCoeff) > 1e-15) {
      if (result && normalizedCoeff > 0) {
        result += ' + '
      } else if (normalizedCoeff < 0) {
        result += n === 0 ? '' : ' - '
      }

      const absCoeff = Math.abs(normalizedCoeff)
      const coeffStr = Number.isInteger(absCoeff) && absCoeff !== 1
        ? absCoeff.toString()
        : absCoeff.toFixed(6).replace(/\.?0+$/, '')

      if (n === 0) {
        result += coeffStr
      } else if (n === 1) {
        const term = center === 0
          ? `${coeffStr}*${variable}`
          : `(${coeffStr}*(${variable} - ${center}))`
        result += term
      } else {
        const power = center === 0
          ? `${variable}^${n}`
          : `(${variable} - ${center})^${n}`
        result += `${coeffStr}*${power}`
      }
    }

    // Compute next derivative
    try {
      currentExpr = customMath.derivative(currentExpr, variable)
    } catch {
      break
    }
  }

  return result || '0'
}

/**
 * Numerical integration using Simpson's rule
 */
function numericalIntegrate(
  expr: math.EvalFunction,
  variable: string,
  lower: number,
  upper: number,
  n: number = 1000
): number {
  const scope: Record<string, number> = {}
  const h = (upper - lower) / n

  const evaluate = (x: number): number => {
    scope[variable] = x
    const result = expr.evaluate(scope)
    return typeof result === 'number' ? result : 0
  }

  let sum = evaluate(lower) + evaluate(upper)

  for (let i = 1; i < n; i++) {
    const x = lower + i * h
    const coeff = i % 2 === 0 ? 2 : 4
    sum += coeff * evaluate(x)
  }

  return (h / 3) * sum
}

export function mathCalculus(input: MathCalculusInput): MathCalculusResult {
  try {
    const {
      operation,
      expression,
      variable = 'x',
      point = 0,
      lowerLimit = 0,
      upperLimit = 1,
      order = 1,
      terms = 5,
      approach = 'both'
    } = input

    // 验证 operation 参数
    if (!operation) {
      return {
        success: false,
        result: '',
        error: '需要指定 operation 参数。可用操作: derivative, evaluate_derivative, integral, evaluate_integral, limit, simplify, taylor, nth_derivative, expand, factor'
      }
    }

    if (!expression || typeof expression !== 'string') {
      return { success: false, result: '', error: '表达式不能为空' }
    }

    // 预处理表达式（转换函数名等）
    const processedExpr = preprocessCalculusExpression(expression)

    // Parse the expression
    let parsed: math.MathNode
    try {
      parsed = customMath.parse(processedExpr)
    } catch {
      return { success: false, result: '', error: '无法解析表达式' }
    }

    switch (operation) {
      case 'derivative': {
        const derivResult = tryDerivative(parsed, variable)
        if (!derivResult.success || !derivResult.result) {
          return { success: false, result: '', error: derivResult.error }
        }
        const simplified = customMath.simplify(derivResult.result)
        return { success: true, result: simplified.toString() }
      }

      case 'evaluate_derivative': {
        // First compute derivative
        const derivResult = tryDerivative(parsed, variable)
        if (!derivResult.success || !derivResult.result) {
          return { success: false, result: '', error: derivResult.error }
        }
        const simplified = customMath.simplify(derivResult.result)
        const compiled = simplified.compile()

        const scope: Record<string, number> = {}
        scope[variable] = point

        const result = compiled.evaluate(scope)
        if (typeof result === 'number') {
          return {
            success: true,
            result: {
              derivative: simplified.toString(),
              value: parseFloat(result.toPrecision(10)),
              point
            }
          }
        }
        return { success: false, result: '', error: '无法计算导数值' }
      }

      case 'integral': {
        // mathjs doesn't have a built-in integrate function
        // Return symbolic guidance for numerical integration
        return {
          success: true,
          result: {
            note: 'mathjs 不支持符号积分，请使用 evaluate_integral 进行数值积分',
            expression,
            suggestion: '对于定积分，使用 evaluate_integral 操作'
          }
        }
      }

      case 'evaluate_integral': {
        // Use numerical integration (Simpson's rule)
        try {
          const compiled = parsed.compile()
          const result = numericalIntegrate(compiled, variable, lowerLimit, upperLimit)
          return {
            success: true,
            result: {
              method: '数值积分（Simpson法则）',
              expression,
              value: parseFloat(result.toPrecision(10)),
              lowerLimit,
              upperLimit
            }
          }
        } catch {
          return { success: false, result: '', error: '无法计算定积分' }
        }
      }

      case 'limit': {
        const compiled = parsed.compile()
        const result = numericalLimit(compiled, variable, point, approach)
        return {
          success: true,
          result: {
            expression,
            variable,
            point,
            approach,
            limit: result
          }
        }
      }

      case 'simplify': {
        const simplified = customMath.simplify(parsed)
        return { success: true, result: simplified.toString() }
      }

      case 'expand': {
        const expanded = customMath.simplify(parsed, [], { exactFractions: true })
        // Try to expand
        const expandResult = customMath.parse(expanded.toString())
        return { success: true, result: expandResult.toString() }
      }

      case 'factor': {
        // mathjs doesn't have direct factor, but simplify can help
        const simplified = customMath.simplify(parsed)
        return { success: true, result: simplified.toString() }
      }

      case 'taylor': {
        const result = taylorExpansion(parsed, variable, point, terms)
        return {
          success: true,
          result: {
            expression,
            variable,
            center: point,
            terms,
            taylorSeries: result
          }
        }
      }

      case 'nth_derivative': {
        let current = parsed
        for (let i = 0; i < order; i++) {
          const derivResult = tryDerivative(current, variable)
          if (!derivResult.success || !derivResult.result) {
            return { success: false, result: '', error: derivResult.error || `无法计算第 ${i + 1} 阶导数` }
          }
          current = derivResult.result
        }
        const simplified = customMath.simplify(current)
        return {
          success: true,
          result: {
            order,
            derivative: simplified.toString()
          }
        }
      }

      default:
        return { success: false, result: '', error: `未知操作: ${operation}` }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, result: '', error: `微积分计算错误: ${message}` }
  }
}
