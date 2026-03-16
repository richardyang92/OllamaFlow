/**
 * Probability and Statistics Tool using mathjs
 * Supports probability distributions, correlation, regression
 */
import * as math from 'mathjs'

export type ProbabilityOperation =
  // Normal distribution
  | 'normal_pdf'
  | 'normal_cdf'
  | 'normal_quantile'
  // Binomial distribution
  | 'binomial_pmf'
  | 'binomial_cdf'
  // Poisson distribution
  | 'poisson_pmf'
  | 'poisson_cdf'
  // Exponential distribution
  | 'exponential_pdf'
  | 'exponential_cdf'
  // Statistical analysis
  | 'correlation'
  | 'covariance'
  | 'linear_regression'
  | 'describe'
  | 'quantile'
  | 'skewness'
  | 'kurtosis'

export interface MathProbabilityInput {
  operation: ProbabilityOperation
  // Normal distribution
  x?: number
  mean?: number
  stddev?: number
  p?: number  // probability for quantile
  // Binomial distribution
  k?: number  // number of successes
  n?: number  // number of trials
  prob?: number  // probability of success
  // Poisson distribution
  lambda?: number  // rate parameter
  // Exponential distribution
  rate?: number  // rate parameter
  // Statistical analysis
  data?: number[]
  dataX?: number[]
  dataY?: number[]
  // Quantile
  q?: number | number[]  // quantile(s) to compute
}

export interface MathProbabilityResult {
  success: boolean
  result: unknown
  error?: string
}

/**
 * Standard normal CDF approximation using error function
 */
function standardNormalCDF(x: number): number {
  // Approximation using Abramowitz and Stegun formula
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911

  const sign = x < 0 ? -1 : 1
  x = Math.abs(x) / Math.sqrt(2)

  const t = 1.0 / (1.0 + p * x)
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)

  return 0.5 * (1.0 + sign * y)
}

/**
 * Inverse normal CDF (quantile function) approximation
 */
function normalQuantile(p: number): number {
  if (p <= 0 || p >= 1) {
    return NaN
  }
  if (p === 0.5) return 0

  // Rational approximation for lower region
  if (p < 0.5) {
    return -normalQuantile(1 - p)
  }

  const t = Math.sqrt(-2 * Math.log(1 - p))
  const c0 = 2.515517
  const c1 = 0.802853
  const c2 = 0.010328
  const d1 = 1.432788
  const d2 = 0.189269
  const d3 = 0.001308

  return t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t)
}

/**
 * Binomial coefficient
 */
function binomialCoef(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  if (k === 0 || k === n) return 1

  k = Math.min(k, n - k)
  let result = 1
  for (let i = 0; i < k; i++) {
    result = result * (n - i) / (i + 1)
  }
  return result
}

/**
 * Binomial PMF
 */
function binomialPMF(k: number, n: number, p: number): number {
  if (k < 0 || k > n || p < 0 || p > 1) return 0
  return binomialCoef(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k)
}

/**
 * Binomial CDF
 */
function binomialCDF(k: number, n: number, p: number): number {
  if (k < 0) return 0
  if (k >= n) return 1

  let sum = 0
  for (let i = 0; i <= k; i++) {
    sum += binomialPMF(i, n, p)
  }
  return sum
}

/**
 * Poisson PMF
 */
function poissonPMF(k: number, lambda: number): number {
  if (k < 0 || lambda <= 0) return 0
  return Math.pow(lambda, k) * Math.exp(-lambda) / math.factorial(k)
}

/**
 * Poisson CDF
 */
function poissonCDF(k: number, lambda: number): number {
  if (k < 0) return 0

  let sum = 0
  for (let i = 0; i <= k; i++) {
    sum += poissonPMF(i, lambda)
  }
  return sum
}

/**
 * Exponential PDF
 */
function exponentialPDF(x: number, rate: number): number {
  if (x < 0 || rate <= 0) return 0
  return rate * Math.exp(-rate * x)
}

/**
 * Exponential CDF
 */
function exponentialCDF(x: number, rate: number): number {
  if (x < 0 || rate <= 0) return 0
  return 1 - Math.exp(-rate * x)
}

/**
 * Pearson correlation coefficient
 */
function correlation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return NaN

  const n = x.length
  const meanX = x.reduce((a, b) => a + b, 0) / n
  const meanY = y.reduce((a, b) => a + b, 0) / n

  let sumXY = 0
  let sumX2 = 0
  let sumY2 = 0

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX
    const dy = y[i] - meanY
    sumXY += dx * dy
    sumX2 += dx * dx
    sumY2 += dy * dy
  }

  return sumXY / Math.sqrt(sumX2 * sumY2)
}

/**
 * Covariance
 */
function covariance(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return NaN

  const n = x.length
  const meanX = x.reduce((a, b) => a + b, 0) / n
  const meanY = y.reduce((a, b) => a + b, 0) / n

  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += (x[i] - meanX) * (y[i] - meanY)
  }

  return sum / n
}

/**
 * Linear regression (least squares)
 */
function linearRegression(x: number[], y: number[]): { slope: number; intercept: number; r2: number } {
  if (x.length !== y.length || x.length < 2) {
    return { slope: NaN, intercept: NaN, r2: NaN }
  }

  const n = x.length
  const meanX = x.reduce((a, b) => a + b, 0) / n
  const meanY = y.reduce((a, b) => a + b, 0) / n

  let sumXY = 0
  let sumX2 = 0
  let sumY2 = 0

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX
    const dy = y[i] - meanY
    sumXY += dx * dy
    sumX2 += dx * dx
    sumY2 += dy * dy
  }

  const slope = sumXY / sumX2
  const intercept = meanY - slope * meanX
  const r = sumXY / Math.sqrt(sumX2 * sumY2)
  const r2 = r * r

  return { slope, intercept, r2 }
}

/**
 * Skewness (third standardized moment)
 */
function skewness(data: number[]): number {
  if (data.length < 3) return NaN

  const n = data.length
  const mean = data.reduce((a, b) => a + b, 0) / n

  let sumDiff3 = 0
  let sumDiff2 = 0

  for (const x of data) {
    const d = x - mean
    sumDiff2 += d * d
    sumDiff3 += d * d * d
  }

  const stdDev = Math.sqrt(sumDiff2 / n)
  if (stdDev === 0) return 0

  return (sumDiff3 / n) / Math.pow(stdDev, 3)
}

/**
 * Kurtosis (fourth standardized moment, excess kurtosis)
 */
function kurtosis(data: number[]): number {
  if (data.length < 4) return NaN

  const n = data.length
  const mean = data.reduce((a, b) => a + b, 0) / n

  let sumDiff4 = 0
  let sumDiff2 = 0

  for (const x of data) {
    const d = x - mean
    sumDiff2 += d * d
    sumDiff4 += d * d * d * d
  }

  const variance = sumDiff2 / n
  if (variance === 0) return 0

  return (sumDiff4 / n) / (variance * variance) - 3
}

/**
 * Quantile calculation
 */
function quantile(data: number[], q: number): number {
  if (!data.length || q < 0 || q > 1) return NaN

  const sorted = [...data].sort((a, b) => a - b)
  const pos = (sorted.length - 1) * q

  if (Number.isInteger(pos)) {
    return sorted[pos]
  }

  const lower = Math.floor(pos)
  const upper = Math.ceil(pos)
  const weight = pos - lower

  return sorted[lower] * (1 - weight) + sorted[upper] * weight
}

/**
 * Extended descriptive statistics
 */
function describe(data: number[]): Record<string, number> {
  if (!data.length) return {}

  const sorted = [...data].sort((a, b) => a - b)
  const n = data.length
  const sum = data.reduce((a, b) => a + b, 0)
  const mean = sum / n

  let sumSqDiff = 0
  for (const x of data) {
    sumSqDiff += (x - mean) ** 2
  }

  const variance = sumSqDiff / n
  const stddev = Math.sqrt(variance)

  return {
    count: n,
    sum,
    mean,
    median: quantile(data, 0.5),
    min: sorted[0],
    max: sorted[n - 1],
    range: sorted[n - 1] - sorted[0],
    variance,
    stddev,
    q1: quantile(data, 0.25),
    q3: quantile(data, 0.75),
    iqr: quantile(data, 0.75) - quantile(data, 0.25),
    skewness: skewness(data),
    kurtosis: kurtosis(data)
  }
}

export function mathProbability(input: MathProbabilityInput): MathProbabilityResult {
  try {
    const { operation } = input

    // 验证 operation 参数
    if (!operation) {
      return {
        success: false,
        result: null,
        error: '需要指定 operation 参数。可用操作: normal_pdf, normal_cdf, normal_quantile, binomial_pmf, binomial_cdf, poisson_pmf, poisson_cdf, exponential_pdf, exponential_cdf, correlation, covariance, linear_regression, describe, quantile, skewness, kurtosis'
      }
    }

    switch (operation) {
      // Normal distribution
      case 'normal_pdf': {
        const { x = 0, mean = 0, stddev = 1 } = input
        const z = (x - mean) / stddev
        const pdf = Math.exp(-0.5 * z * z) / (stddev * Math.sqrt(2 * Math.PI))
        return { success: true, result: pdf }
      }

      case 'normal_cdf': {
        const { x = 0, mean = 0, stddev = 1 } = input
        const z = (x - mean) / stddev
        const cdf = standardNormalCDF(z)
        return { success: true, result: cdf }
      }

      case 'normal_quantile': {
        const { p = 0.5, mean = 0, stddev = 1 } = input
        const z = normalQuantile(p)
        const x = mean + z * stddev
        return { success: true, result: x }
      }

      // Binomial distribution
      case 'binomial_pmf': {
        const { k = 0, n = 10, prob = 0.5 } = input
        const pmf = binomialPMF(k, n, prob)
        return { success: true, result: pmf }
      }

      case 'binomial_cdf': {
        const { k = 0, n = 10, prob = 0.5 } = input
        const cdf = binomialCDF(k, n, prob)
        return { success: true, result: cdf }
      }

      // Poisson distribution
      case 'poisson_pmf': {
        const { k = 0, lambda = 1 } = input
        const pmf = poissonPMF(k, lambda)
        return { success: true, result: pmf }
      }

      case 'poisson_cdf': {
        const { k = 0, lambda = 1 } = input
        const cdf = poissonCDF(k, lambda)
        return { success: true, result: cdf }
      }

      // Exponential distribution
      case 'exponential_pdf': {
        const { x = 0, rate = 1 } = input
        const pdf = exponentialPDF(x, rate)
        return { success: true, result: pdf }
      }

      case 'exponential_cdf': {
        const { x = 0, rate = 1 } = input
        const cdf = exponentialCDF(x, rate)
        return { success: true, result: cdf }
      }

      // Statistical analysis
      case 'correlation': {
        const { dataX = [], dataY = [] } = input
        if (!dataX.length || !dataY.length) {
          return { success: false, result: null, error: '需要 dataX 和 dataY' }
        }
        const r = correlation(dataX, dataY)
        return { success: true, result: r }
      }

      case 'covariance': {
        const { dataX = [], dataY = [] } = input
        if (!dataX.length || !dataY.length) {
          return { success: false, result: null, error: '需要 dataX 和 dataY' }
        }
        const cov = covariance(dataX, dataY)
        return { success: true, result: cov }
      }

      case 'linear_regression': {
        const { dataX = [], dataY = [] } = input
        if (!dataX.length || !dataY.length) {
          return { success: false, result: null, error: '需要 dataX 和 dataY' }
        }
        const reg = linearRegression(dataX, dataY)
        return {
          success: true,
          result: {
            slope: reg.slope,
            intercept: reg.intercept,
            equation: `y = ${reg.slope.toFixed(6)}x + ${reg.intercept.toFixed(6)}`,
            r2: reg.r2
          }
        }
      }

      case 'describe': {
        const { data = [] } = input
        if (!data.length) {
          return { success: false, result: null, error: '需要 data' }
        }
        const stats = describe(data)
        return { success: true, result: stats }
      }

      case 'quantile': {
        const { data = [], q = 0.5 } = input
        if (!data.length) {
          return { success: false, result: null, error: '需要 data' }
        }
        if (Array.isArray(q)) {
          const results: Record<number, number> = {}
          for (const qi of q) {
            results[qi] = quantile(data, qi)
          }
          return { success: true, result: results }
        }
        const result = quantile(data, q)
        return { success: true, result }
      }

      case 'skewness': {
        const { data = [] } = input
        if (!data.length) {
          return { success: false, result: null, error: '需要 data' }
        }
        const s = skewness(data)
        return { success: true, result: s }
      }

      case 'kurtosis': {
        const { data = [] } = input
        if (!data.length) {
          return { success: false, result: null, error: '需要 data' }
        }
        const k = kurtosis(data)
        return { success: true, result: k }
      }

      default:
        return { success: false, result: null, error: `未知操作: ${operation}` }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, result: null, error: `概率计算错误: ${message}` }
  }
}
