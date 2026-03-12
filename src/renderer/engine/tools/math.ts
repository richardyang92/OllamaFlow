import { Parser } from 'safe-expr-eval'

// Types for math tool operations
export type MathOutputFormat = 'auto' | 'decimal' | 'fraction' | 'percent'

export interface MathCalculateInput {
  expression: string
  precision?: number
  outputFormat?: MathOutputFormat
}

export interface MathStatisticsInput {
  data: number[]
  operations: StatisticsOperation[]
}

export type StatisticsOperation =
  | 'mean'
  | 'median'
  | 'mode'
  | 'variance'
  | 'stddev'
  | 'sum'
  | 'max'
  | 'min'
  | 'range'
  | 'count'

export interface MathCalculateResult {
  success: boolean
  result: string
  rawValue?: number
  isExact?: boolean
  error?: string
}

export interface MathStatisticsResult {
  success: boolean
  results: Record<string, number | string>
  error?: string
}

// ============================================================================
// Custom Math Functions
// ============================================================================

/**
 * Combination: C(n,k) = n! / (k!(n-k)!)
 * Uses multiplicative formula for better numerical stability
 */
function combination(n: number, k: number): number {
  if (k < 0 || k > n || !Number.isInteger(n) || !Number.isInteger(k)) {
    return NaN
  }
  if (k === 0 || k === n) return 1
  // Use the smaller k for efficiency
  k = Math.min(k, n - k)
  let result = 1
  for (let i = 0; i < k; i++) {
    result *= (n - i) / (i + 1)
  }
  return result
}

/**
 * Permutation: P(n,k) = n! / (n-k)!
 */
function permutation(n: number, k: number): number {
  if (k < 0 || k > n || !Number.isInteger(n) || !Number.isInteger(k)) {
    return NaN
  }
  if (k === 0) return 1
  let result = 1
  for (let i = 0; i < k; i++) {
    result *= (n - i)
  }
  return result
}

/**
 * Greatest Common Divisor using Euclidean algorithm
 */
function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  if (a === 0) return b
  if (b === 0) return a
  while (b) {
    const t = b
    b = a % b
    a = t
  }
  return a
}

/**
 * Least Common Multiple: lcm(a,b) = |a*b| / gcd(a,b)
 */
function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return Math.abs(a * b) / gcd(a, b)
}

// ============================================================================
// Parser Configuration
// ============================================================================

/**
 * Create a secure parser with custom math functions
 * Note: safe-expr-eval has a simplified API without operator configuration options
 * We need to add all standard Math functions manually
 */
function createMathParser(): Parser {
  const parser = new Parser()

  // Basic Math functions
  parser.functions.sqrt = Math.sqrt
  parser.functions.cbrt = Math.cbrt
  parser.functions.abs = Math.abs
  parser.functions.ceil = Math.ceil
  parser.functions.floor = Math.floor
  parser.functions.round = Math.round
  parser.functions.trunc = Math.trunc
  parser.functions.sign = Math.sign
  parser.functions.exp = Math.exp
  parser.functions.expm1 = Math.expm1
  parser.functions.log = Math.log
  parser.functions.log10 = Math.log10
  parser.functions.log2 = Math.log2
  parser.functions.log1p = Math.log1p
  parser.functions.pow = Math.pow
  parser.functions.max = Math.max
  parser.functions.min = Math.min
  parser.functions.clz32 = Math.clz32
  parser.functions.imul = Math.imul
  parser.functions.fround = Math.fround
  parser.functions.hypot = Math.hypot

  // Trigonometric functions
  parser.functions.sin = Math.sin
  parser.functions.cos = Math.cos
  parser.functions.tan = Math.tan
  parser.functions.asin = Math.asin
  parser.functions.acos = Math.acos
  parser.functions.atan = Math.atan
  parser.functions.atan2 = Math.atan2
  parser.functions.sinh = Math.sinh
  parser.functions.cosh = Math.cosh
  parser.functions.tanh = Math.tanh
  parser.functions.asinh = Math.asinh
  parser.functions.acosh = Math.acosh
  parser.functions.atanh = Math.atanh

  // Custom combinatorics functions
  parser.functions.comb = combination
  parser.functions.perm = permutation
  parser.functions.lcm = lcm
  parser.functions.gcd = gcd
  parser.functions.factorial = factorial

  // Aliases for common notation
  parser.functions.ln = Math.log

  // Ensure constants are set
  parser.consts.PI = Math.PI
  parser.consts.E = Math.E
  parser.consts.pi = Math.PI
  parser.consts.e = Math.E

  return parser
}

// ============================================================================
// Expression Preprocessing
// ============================================================================

/**
 * Factorial function for non-negative integers
 */
function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) return NaN
  if (n <= 1) return 1
  if (n > 170) {
    // For very large n, return approximation using scientific notation
    // Using Stirling's approximation: n! ≈ sqrt(2πn) * (n/e)^n
    return Number.POSITIVE_INFINITY
  }
  let result = 1
  for (let i = 2; i <= n; i++) {
    result *= i
  }
  return result
}

/**
 * Preprocess expression to convert custom notations to standard format
 */
function preprocessExpression(expr: string): string {
  let processed = expr.trim()

  // Replace π with PI
  processed = processed.replace(/π/g, 'PI')

  // Convert power operations: a**b to pow(a,b)
  // First, replace ** with ^ for uniformity
  processed = processed.replace(/\*\*/g, '^')

  // Now convert a^b to pow(a,b) - need to handle this carefully
  // This is simplified - for full support we'd need proper AST parsing
  // For now, we'll handle simple cases: number^number, variable^number
  processed = processed.replace(/([0-9.]+)\s*\^\s*([0-9.]+)/g, 'pow($1, $2)')
  processed = processed.replace(/([a-zA-Z_]\w*)\s*\^\s*([0-9.]+)/g, 'pow($1, $2)')
  processed = processed.replace(/(\([^)]+\))\s*\^\s*([0-9.]+)/g, 'pow($1, $2)')

  // Convert factorial notation n! to factorial(n)
  // This handles cases like 5!, 10!, etc.
  processed = processed.replace(/(\d+)\s*!/g, 'factorial($1)')

  // Convert C(n,k) notation to comb(n,k)
  // Match pattern like C(10,3) or C (10, 3)
  processed = processed.replace(/\bC\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/g, 'comb($1, $2)')

  // Convert P(n,k) notation to perm(n,k)
  processed = processed.replace(/\bP\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/g, 'perm($1, $2)')

  return processed
}

// ============================================================================
// Output Formatting
// ============================================================================

/**
 * Convert a decimal to a fraction using continued fraction algorithm
 * Returns null if the fraction denominator is too large
 */
function toFraction(value: number, maxDenominator = 100): string | null {
  if (!Number.isFinite(value) || Number.isInteger(value)) {
    return null
  }

  // Handle negative numbers
  const sign = value < 0 ? -1 : 1
  value = Math.abs(value)

  // Continued fraction algorithm
  let numerator = 1
  let denominator = 1
  let remainder = value

  for (let i = 0; i < 20; i++) {
    const whole = Math.floor(remainder)
    const frac = remainder - whole

    if (frac < 1e-10) {
      numerator = whole * denominator
      break
    }

    const newNumerator = whole * denominator + numerator
    const newDenominator = denominator

    // Check if denominator exceeds max
    if (newDenominator > maxDenominator) {
      // Use previous approximation
      break
    }

    numerator = newNumerator
    denominator = newDenominator

    if (frac < 1e-10) break

    remainder = 1 / frac
  }

  // Simplify the fraction
  const commonDivisor = gcd(numerator, denominator)
  numerator /= commonDivisor
  denominator /= commonDivisor

  // Check if the fraction is a good approximation
  const approxValue = numerator / denominator
  if (Math.abs(value - approxValue) > 1e-6) {
    return null // Not a good approximation
  }

  return sign < 0 ? `-${numerator}/${denominator}` : `${numerator}/${denominator}`
}

/**
 * Format a numeric result according to the specified format
 */
function formatResult(
  value: number,
  format: MathOutputFormat = 'auto',
  precision?: number
): string {
  // Handle special values
  if (!Number.isFinite(value)) {
    return value > 0 ? 'Infinity' : value < 0 ? '-Infinity' : 'NaN'
  }

  // Handle NaN
  if (Number.isNaN(value)) {
    return 'NaN'
  }

  switch (format) {
    case 'decimal':
      return value.toFixed(precision ?? 6)

    case 'fraction': {
      const frac = toFraction(value)
      return frac ?? value.toFixed(precision ?? 6)
    }

    case 'percent':
      return `${(value * 100).toFixed(precision ?? 2)}%`

    case 'auto':
    default:
      // Integers stay as integers
      if (Number.isInteger(value)) {
        return value.toString()
      }

      // Very large or very small numbers use scientific notation
      if (Math.abs(value) > 1e15 || (Math.abs(value) < 1e-10 && value !== 0)) {
        return value.toExponential(6)
      }

      // Try fraction first for simple rational numbers
      const frac = toFraction(value)
      if (frac) {
        return frac
      }

      // Default to decimal with reasonable precision
      const defaultPrecision = precision ?? (value.toString().split('.')[1]?.length ?? 6)
      return value.toFixed(Math.min(defaultPrecision, 10))
  }
}

// ============================================================================
// Math Calculate
// ============================================================================

/**
 * Evaluate a mathematical expression and return the result
 */
export function mathCalculate(input: MathCalculateInput): MathCalculateResult {
  try {
    const { expression, precision, outputFormat = 'auto' } = input

    if (!expression || typeof expression !== 'string') {
      return {
        success: false,
        result: '',
        error: '表达式不能为空',
      }
    }

    // Preprocess the expression
    const processedExpr = preprocessExpression(expression)

    // Create parser and evaluate
    const parser = createMathParser()
    const result = parser.evaluate(processedExpr)

    // Handle different result types
    if (typeof result === 'number') {
      // Check for special values
      if (!Number.isFinite(result)) {
        return {
          success: true,
          result: result > 0 ? 'Infinity' : '-Infinity',
          rawValue: result,
          isExact: true,
        }
      }

      if (Number.isNaN(result)) {
        return {
          success: false,
          result: '',
          error: '计算结果无效 (NaN)',
        }
      }

      // Format the result
      const formatted = formatResult(result, outputFormat, precision)

      return {
        success: true,
        result: formatted,
        rawValue: result,
        isExact: Number.isInteger(result),
      }
    }

    // Non-numeric results (arrays, objects, etc.)
    return {
      success: true,
      result: JSON.stringify(result),
      rawValue: result as number,
      isExact: true,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      result: '',
      error: `计算错误: ${message}`,
    }
  }
}

// ============================================================================
// Math Statistics
// ============================================================================

/**
 * Calculate mean (average) of an array
 */
function mean(data: number[]): number {
  if (data.length === 0) return NaN
  return data.reduce((sum, val) => sum + val, 0) / data.length
}

/**
 * Calculate median of an array
 */
function median(data: number[]): number {
  if (data.length === 0) return NaN
  const sorted = [...data].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Calculate mode (most frequent value) of an array
 */
function mode(data: number[]): number[] {
  if (data.length === 0) return []
  const frequency = new Map<number, number>()
  for (const value of data) {
    frequency.set(value, (frequency.get(value) ?? 0) + 1)
  }
  const maxFreq = Math.max(...frequency.values())
  return Array.from(frequency.entries())
    .filter(([_, freq]) => freq === maxFreq)
    .map(([value]) => value)
}

/**
 * Calculate variance of an array (population variance)
 */
function variance(data: number[]): number {
  if (data.length === 0) return NaN
  if (data.length === 1) return 0
  const avg = mean(data)
  return data.reduce((sum, val) => sum + (val - avg) ** 2, 0) / data.length
}

/**
 * Calculate standard deviation of an array
 */
function stddev(data: number[]): number {
  return Math.sqrt(variance(data))
}

/**
 * Calculate range (max - min) of an array
 */
function range(data: number[]): number {
  if (data.length === 0) return NaN
  return Math.max(...data) - Math.min(...data)
}

/**
 * Perform statistical calculations on an array of numbers
 */
export function mathStatistics(input: MathStatisticsInput): MathStatisticsResult {
  try {
    const { data, operations } = input

    if (!Array.isArray(data) || data.length === 0) {
      return {
        success: false,
        results: {},
        error: '数据必须是非空数组',
      }
    }

    // Validate all values are numbers
    if (!data.every((v) => typeof v === 'number' && Number.isFinite(v))) {
      return {
        success: false,
        results: {},
        error: '所有数据值必须是有效的数字',
      }
    }

    const results: Record<string, number | string> = {}

    for (const op of operations) {
      switch (op) {
        case 'mean':
          results.mean = mean(data)
          break
        case 'median':
          results.median = median(data)
          break
        case 'mode': {
          const modes = mode(data)
          results.mode = modes.length === 1 ? modes[0] : modes.join(', ')
          break
        }
        case 'variance':
          results.variance = variance(data)
          break
        case 'stddev':
          results.stddev = stddev(data)
          break
        case 'sum':
          results.sum = data.reduce((sum, val) => sum + val, 0)
          break
        case 'max':
          results.max = Math.max(...data)
          break
        case 'min':
          results.min = Math.min(...data)
          break
        case 'range':
          results.range = range(data)
          break
        case 'count':
          results.count = data.length
          break
      }
    }

    return {
      success: true,
      results,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      results: {},
      error: `统计计算错误: ${message}`,
    }
  }
}
