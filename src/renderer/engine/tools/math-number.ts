/**
 * Number Theory Tool
 * Supports prime operations, GCD, LCM, factorials, combinatorics
 */
import * as math from 'mathjs'

export type NumberTheoryOperation =
  | 'is_prime'       // Primality test
  | 'prime_factors'  // Prime factorization
  | 'prime_sieve'    // Sieve of Eratosthenes
  | 'next_prime'     // Next prime after n
  | 'prev_prime'     // Previous prime before n
  | 'gcd'            // Greatest common divisor
  | 'lcm'            // Least common multiple
  | 'mod_exp'        // Modular exponentiation
  | 'mod_inverse'    // Modular multiplicative inverse
  | 'fibonacci'      // Fibonacci sequence
  | 'factorial'      // Factorial
  | 'permutations'   // Permutations P(n,k)
  | 'combinations'   // Combinations C(n,k)
  | 'digit_sum'      // Sum of digits
  | 'is_perfect'     // Perfect number test
  | 'divisors'       // All divisors
  | 'totient'        // Euler's totient function
  | 'is_coprime'     // Coprime test
  | 'catalan'        // Catalan number

export interface MathNumberTheoryInput {
  operation: NumberTheoryOperation
  number?: number
  a?: number
  b?: number
  n?: number
  k?: number
  base?: number
  exponent?: number
  modulus?: number
  limit?: number
}

export interface MathNumberTheoryResult {
  success: boolean
  result: unknown
  error?: string
}

/**
 * Miller-Rabin primality test
 */
function isPrime(n: number): boolean {
  if (n < 2) return false
  if (n === 2 || n === 3) return true
  if (n % 2 === 0) return false

  // Write n-1 as 2^r * d
  let r = 0
  let d = n - 1
  while (d % 2 === 0) {
    r++
    d = Math.floor(d / 2)
  }

  // Witnesses for deterministic test up to 2^64
  const witnesses = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37]

  const modPow = (base: number, exp: number, mod: number): number => {
    let result = 1
    base = base % mod
    while (exp > 0) {
      if (exp % 2 === 1) {
        result = (result * base) % mod
      }
      exp = Math.floor(exp / 2)
      base = (base * base) % mod
    }
    return result
  }

  for (const a of witnesses) {
    if (a >= n) continue

    let x = modPow(a, d, n)

    if (x === 1 || x === n - 1) continue

    let composite = true
    for (let i = 0; i < r - 1; i++) {
      x = (x * x) % n
      if (x === n - 1) {
        composite = false
        break
      }
    }

    if (composite) return false
  }

  return true
}

/**
 * Prime factorization using trial division
 */
function primeFactors(n: number): { prime: number; exponent: number }[] {
  if (n < 2) return []

  const factors: Map<number, number> = new Map()
  let num = n

  // Check for factor of 2
  while (num % 2 === 0) {
    factors.set(2, (factors.get(2) ?? 0) + 1)
    num = Math.floor(num / 2)
  }

  // Check odd factors
  for (let i = 3; i * i <= num; i += 2) {
    while (num % i === 0) {
      factors.set(i, (factors.get(i) ?? 0) + 1)
      num = Math.floor(num / i)
    }
  }

  // If num is still greater than 1, it's a prime factor
  if (num > 1) {
    factors.set(num, 1)
  }

  return Array.from(factors.entries())
    .map(([prime, exponent]) => ({ prime, exponent }))
    .sort((a, b) => a.prime - b.prime)
}

/**
 * Sieve of Eratosthenes
 */
function primeSieve(limit: number): number[] {
  if (limit < 2) return []

  const sieve = new Array(limit + 1).fill(true)
  sieve[0] = sieve[1] = false

  for (let i = 2; i * i <= limit; i++) {
    if (sieve[i]) {
      for (let j = i * i; j <= limit; j += i) {
        sieve[j] = false
      }
    }
  }

  const primes: number[] = []
  for (let i = 2; i <= limit; i++) {
    if (sieve[i]) primes.push(i)
  }

  return primes
}

/**
 * Extended Euclidean algorithm
 */
function extendedGCD(a: number, b: number): { gcd: number; x: number; y: number } {
  if (a === 0) return { gcd: b, x: 0, y: 1 }

  const result = extendedGCD(b % a, a)
  return {
    gcd: result.gcd,
    x: result.y - Math.floor(b / a) * result.x,
    y: result.x
  }
}

/**
 * Modular multiplicative inverse
 */
function modInverse(a: number, m: number): number | null {
  const result = extendedGCD(a % m, m)
  if (result.gcd !== 1) return null
  return ((result.x % m) + m) % m
}

/**
 * Fast modular exponentiation
 */
function modPow(base: number, exponent: number, modulus: number): number {
  if (modulus === 1) return 0

  let result = 1
  base = ((base % modulus) + modulus) % modulus

  while (exponent > 0) {
    if (exponent % 2 === 1) {
      result = (result * base) % modulus
    }
    exponent = Math.floor(exponent / 2)
    base = (base * base) % modulus
  }

  return result
}

/**
 * Fibonacci using matrix exponentiation
 */
function fibonacci(n: number): number {
  if (n < 0) return NaN
  if (n === 0) return 0
  if (n === 1) return 1

  const matrixMultiply = (a: number[][], b: number[][]): number[][] => {
    return [
      [a[0][0] * b[0][0] + a[0][1] * b[1][0], a[0][0] * b[0][1] + a[0][1] * b[1][1]],
      [a[1][0] * b[0][0] + a[1][1] * b[1][0], a[1][0] * b[0][1] + a[1][1] * b[1][1]]
    ]
  }

  const matrixPow = (m: number[][], p: number): number[][] => {
    if (p === 1) return m
    if (p % 2 === 0) {
      const half = matrixPow(m, p / 2)
      return matrixMultiply(half, half)
    }
    return matrixMultiply(m, matrixPow(m, p - 1))
  }

  const base: number[][] = [[1, 1], [1, 0]]
  const result = matrixPow(base, n)
  return result[0][1]
}

/**
 * Sum of digits
 */
function digitSum(n: number): number {
  return Math.abs(n)
    .toString()
    .split('')
    .filter(c => c >= '0' && c <= '9')
    .reduce((sum, d) => sum + parseInt(d, 10), 0)
}

/**
 * Get all divisors of a number
 */
function divisors(n: number): number[] {
  if (n < 1) return []

  const positiveDivisors: number[] = []
  const absN = Math.abs(n)

  for (let i = 1; i * i <= absN; i++) {
    if (absN % i === 0) {
      positiveDivisors.push(i)
      if (i !== absN / i) {
        positiveDivisors.push(absN / i)
      }
    }
  }

  return positiveDivisors.sort((a, b) => a - b)
}

/**
 * Check if a number is perfect (sum of proper divisors equals the number)
 */
function isPerfect(n: number): boolean {
  if (n < 2) return false

  const properDivisors = divisors(n).slice(0, -1) // Exclude n itself
  const sum = properDivisors.reduce((a, b) => a + b, 0)

  return sum === n
}

/**
 * Euler's totient function
 */
function totient(n: number): number {
  if (n < 1) return 0
  if (n === 1) return 1

  const factors = primeFactors(n)
  let result = n

  for (const { prime } of factors) {
    result = Math.floor(result * (prime - 1) / prime)
  }

  return result
}

/**
 * Catalan number
 */
function catalan(n: number): number {
  if (n < 0) return NaN

  // C(n) = C(2n, n) / (n + 1)
  const binomial = math.combinations(2 * n, n) as number
  return binomial / (n + 1)
}

export function mathNumberTheory(input: MathNumberTheoryInput): MathNumberTheoryResult {
  try {
    const { operation } = input

    // 验证 operation 参数
    if (!operation) {
      return {
        success: false,
        result: null,
        error: '需要指定 operation 参数。可用操作: is_prime, prime_factors, prime_sieve, next_prime, prev_prime, gcd, lcm, mod_exp, mod_inverse, fibonacci, factorial, permutations, combinations, digit_sum, is_perfect, divisors, totient, is_coprime, catalan'
      }
    }

    switch (operation) {
      case 'is_prime': {
        const { number = 0 } = input
        const result = isPrime(number)
        return { success: true, result }
      }

      case 'prime_factors': {
        const { number = 0 } = input
        if (number < 2) {
          return { success: false, result: null, error: 'number 必须 >= 2' }
        }
        const factors = primeFactors(number)
        return {
          success: true,
          result: {
            number,
            factors,
            factorization: factors.map(f => `${f.prime}^${f.exponent}`).join(' * ')
          }
        }
      }

      case 'prime_sieve': {
        const { limit = 100 } = input
        if (limit < 2) {
          return { success: false, result: null, error: 'limit 必须 >= 2' }
        }
        const primes = primeSieve(limit)
        return {
          success: true,
          result: {
            limit,
            count: primes.length,
            primes
          }
        }
      }

      case 'next_prime': {
        let { number = 0 } = input
        if (number < 2) number = 1
        let candidate = number + 1
        while (!isPrime(candidate)) {
          candidate++
        }
        return { success: true, result: candidate }
      }

      case 'prev_prime': {
        let { number = 3 } = input
        if (number <= 2) {
          return { success: false, result: null, error: '没有比 2 更小的质数' }
        }
        let candidate = number - 1
        while (candidate >= 2 && !isPrime(candidate)) {
          candidate--
        }
        if (candidate < 2) {
          return { success: false, result: null, error: '没有更小的质数' }
        }
        return { success: true, result: candidate }
      }

      case 'gcd': {
        const { a = 0, b = 0 } = input
        const result = math.gcd(a, b) as number
        return { success: true, result }
      }

      case 'lcm': {
        const { a = 0, b = 0 } = input
        const result = math.lcm(a, b) as number
        return { success: true, result }
      }

      case 'mod_exp': {
        const { base = 0, exponent = 0, modulus = 1 } = input
        if (modulus <= 0) {
          return { success: false, result: null, error: 'modulus 必须 > 0' }
        }
        const result = modPow(base, exponent, modulus)
        return { success: true, result }
      }

      case 'mod_inverse': {
        const { a = 0, modulus = 1 } = input
        if (modulus <= 0) {
          return { success: false, result: null, error: 'modulus 必须 > 0' }
        }
        const result = modInverse(a, modulus)
        if (result === null) {
          return { success: false, result: null, error: `${a} 和 ${modulus} 不互质，逆元不存在` }
        }
        return { success: true, result }
      }

      case 'fibonacci': {
        const { n = 0 } = input
        if (n < 0) {
          return { success: false, result: null, error: 'n 必须 >= 0' }
        }
        const result = fibonacci(n)
        return { success: true, result }
      }

      case 'factorial': {
        const { n = 0 } = input
        if (n < 0) {
          return { success: false, result: null, error: 'n 必须 >= 0' }
        }
        if (n > 170) {
          return { success: false, result: null, error: 'n 太大（最大支持 170）' }
        }
        const result = math.factorial(n) as number
        return { success: true, result }
      }

      case 'permutations': {
        const { n = 0, k = 0 } = input
        if (n < 0 || k < 0 || k > n) {
          return { success: false, result: null, error: '需要 0 <= k <= n' }
        }
        const result = math.permutations(n, k) as number
        return { success: true, result }
      }

      case 'combinations': {
        const { n = 0, k = 0 } = input
        if (n < 0 || k < 0 || k > n) {
          return { success: false, result: null, error: '需要 0 <= k <= n' }
        }
        const result = math.combinations(n, k) as number
        return { success: true, result }
      }

      case 'digit_sum': {
        const { number = 0 } = input
        const result = digitSum(number)
        return { success: true, result }
      }

      case 'is_perfect': {
        const { number = 0 } = input
        const result = isPerfect(number)
        return { success: true, result }
      }

      case 'divisors': {
        const { number = 1 } = input
        if (number < 1) {
          return { success: false, result: null, error: 'number 必须 >= 1' }
        }
        const result = divisors(number)
        return { success: true, result: { number, divisors: result, count: result.length } }
      }

      case 'totient': {
        const { n = 1 } = input
        if (n < 1) {
          return { success: false, result: null, error: 'n 必须 >= 1' }
        }
        const result = totient(n)
        return { success: true, result }
      }

      case 'is_coprime': {
        const { a = 0, b = 0 } = input
        const gcd = math.gcd(a, b) as number
        const result = gcd === 1
        return { success: true, result }
      }

      case 'catalan': {
        const { n = 0 } = input
        if (n < 0) {
          return { success: false, result: null, error: 'n 必须 >= 0' }
        }
        const result = catalan(n)
        return { success: true, result }
      }

      default:
        return { success: false, result: null, error: `未知操作: ${operation}` }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, result: null, error: `数论计算错误: ${message}` }
  }
}
