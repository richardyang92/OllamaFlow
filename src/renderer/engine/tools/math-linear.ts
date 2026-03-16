/**
 * Linear Algebra Tool using mathjs
 * Supports matrix operations, vector operations, decompositions
 */
import * as math from 'mathjs'

export type LinearAlgebraOperation =
  | 'add'           // Matrix/vector addition
  | 'subtract'      // Matrix/vector subtraction
  | 'multiply'      // Matrix multiplication
  | 'transpose'     // Matrix transpose
  | 'determinant'   | 'det'  // Determinant
  | 'inverse'       | 'inv'  // Matrix inverse
  | 'eigenvalues'   // Eigenvalues only
  | 'eigenvectors'  // Eigenvectors only
  | 'eigs'          // Full eigen decomposition
  | 'rank'          // Matrix rank
  | 'norm'          // Matrix/vector norm
  | 'dot'           // Vector dot product
  | 'cross'         // Vector cross product
  | 'trace'         // Matrix trace
  | 'svd'           // Singular value decomposition
  | 'lu'            // LU decomposition
  | 'qr'            // QR decomposition
  | 'identity'      // Identity matrix
  | 'zeros'         // Zero matrix
  | 'ones'          // Ones matrix
  | 'size'          // Matrix dimensions
  | 'solve_linear'  // Solve linear system Ax = b

export interface MathLinearAlgebraInput {
  operation: LinearAlgebraOperation
  matrixA?: number[][] | number[]
  matrixB?: number[][] | number[]
  vectorA?: number[]
  vectorB?: number[]  // For dot, cross, and solve_linear
  matrix?: number[][] | number[]
  normType?: 'fro' | '1' | '2' | 'inf' | 'max'
  size?: [number, number] | number
}

export interface MathLinearAlgebraResult {
  success: boolean
  result: unknown
  error?: string
}

function parseMatrix(input: unknown): math.Matrix | number[] {
  if (Array.isArray(input)) {
    if (input.length === 0 || typeof input[0] === 'number') {
      return input as number[]
    }
    return math.matrix(input as math.MathArray)
  }
  throw new Error('无效的矩阵格式')
}

function formatResult(value: unknown): unknown {
  if (math.isMatrix(value)) {
    return value.toArray()
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return value > 0 ? 'Infinity' : value < 0 ? '-Infinity' : 'NaN'
    }
    // Format with reasonable precision
    if (Number.isInteger(value)) {
      return value
    }
    return parseFloat(value.toPrecision(12))
  }
  if (typeof value === 'object' && value !== null) {
    // Handle decomposition results
    if ('values' in value) {
      const obj = value as Record<string, unknown>
      return {
        values: formatResult(obj.values),
        vectors: obj.vectors ? formatResult(obj.vectors) : undefined
      }
    }
    if ('U' in value || 'L' in value || 'Q' in value || 'R' in value) {
      const formatted: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(value)) {
        formatted[k] = formatResult(v)
      }
      return formatted
    }
  }
  return value
}

export function mathLinearAlgebra(input: MathLinearAlgebraInput): MathLinearAlgebraResult {
  try {
    const { operation, normType = 'fro' } = input

    // 验证 operation 参数
    if (!operation) {
      return {
        success: false,
        result: null,
        error: '需要指定 operation 参数。可用操作: add, subtract, multiply, transpose, determinant, inverse, eigenvalues, eigenvectors, eigs, rank, norm, dot, cross, trace, lu, qr, solve_linear, identity, zeros, ones, size'
      }
    }

    switch (operation) {
      case 'add': {
        if (!input.matrixA || !input.matrixB) {
          return { success: false, result: null, error: '需要 matrixA 和 matrixB' }
        }
        const a = parseMatrix(input.matrixA)
        const b = parseMatrix(input.matrixB)
        const result = math.add(a, b)
        return { success: true, result: formatResult(result) }
      }

      case 'subtract': {
        if (!input.matrixA || !input.matrixB) {
          return { success: false, result: null, error: '需要 matrixA 和 matrixB' }
        }
        const a = parseMatrix(input.matrixA)
        const b = parseMatrix(input.matrixB)
        const result = math.subtract(a, b)
        return { success: true, result: formatResult(result) }
      }

      case 'multiply': {
        if (!input.matrixA || !input.matrixB) {
          return { success: false, result: null, error: '需要 matrixA 和 matrixB' }
        }
        const a = parseMatrix(input.matrixA)
        const b = parseMatrix(input.matrixB)
        const result = math.multiply(a, b)
        return { success: true, result: formatResult(result) }
      }

      case 'transpose': {
        if (!input.matrix) {
          return { success: false, result: null, error: '需要 matrix' }
        }
        const m = parseMatrix(input.matrix)
        const result = math.transpose(m)
        return { success: true, result: formatResult(result) }
      }

      case 'determinant':
      case 'det': {
        if (!input.matrix) {
          return { success: false, result: null, error: '需要 matrix' }
        }
        const m = parseMatrix(input.matrix)
        const result = math.det(m as math.Matrix)
        return { success: true, result: formatResult(result) }
      }

      case 'inverse':
      case 'inv': {
        if (!input.matrix) {
          return { success: false, result: null, error: '需要 matrix' }
        }
        const m = parseMatrix(input.matrix)
        const result = math.inv(m as math.Matrix)
        return { success: true, result: formatResult(result) }
      }

      case 'eigenvalues': {
        if (!input.matrix) {
          return { success: false, result: null, error: '需要 matrix' }
        }
        const m = parseMatrix(input.matrix)
        const eigs = math.eigs(m as math.Matrix)
        const values = (eigs as { values: math.MathCollection }).values
        return { success: true, result: formatResult(values) }
      }

      case 'eigenvectors': {
        if (!input.matrix) {
          return { success: false, result: null, error: '需要 matrix' }
        }
        const m = parseMatrix(input.matrix)
        const eigsResult = math.eigs(m as math.Matrix)
        // mathjs eigs returns { values, eigenvectors }
        const eigsTyped = eigsResult as unknown as {
          values: math.MathCollection
          eigenvectors?: Array<{ value: number | math.BigNumber; vector: math.MathCollection }>
        }
        // Extract just the vectors
        const vectors = eigsTyped.eigenvectors?.map(e => formatResult(e.vector)) || []
        return { success: true, result: vectors }
      }

      case 'eigs': {
        if (!input.matrix) {
          return { success: false, result: null, error: '需要 matrix' }
        }
        const m = parseMatrix(input.matrix)
        const eigs = math.eigs(m as math.Matrix) as unknown as {
          values: math.MathCollection
          eigenvectors: Array<{ value: number; vector: math.MathCollection }>
        }
        // Format as readable object
        return {
          success: true,
          result: {
            values: formatResult(eigs.values),
            vectors: eigs.eigenvectors?.map(e => ({
              value: e.value,
              vector: formatResult(e.vector)
            })) || []
          }
        }
      }

      case 'rank': {
        if (!input.matrix) {
          return { success: false, result: null, error: '需要 matrix' }
        }
        const m = parseMatrix(input.matrix)
        // Calculate rank using LU decomposition (count non-zero diagonal elements)
        const luResult = math.lup(m as math.Matrix) as unknown as {
          L: math.Matrix
          U: math.Matrix
          P: math.Matrix
        }
        const uMatrix = luResult.U.toArray() as number[][]
        const tol = 1e-10
        let rank = 0
        for (let i = 0; i < Math.min(uMatrix.length, uMatrix[0]?.length || 0); i++) {
          if (Math.abs(uMatrix[i][i]) > tol) {
            rank++
          }
        }
        return { success: true, result: rank }
      }

      case 'norm': {
        const target = input.matrix || input.vectorA
        if (!target) {
          return { success: false, result: null, error: '需要 matrix 或 vectorA' }
        }
        const m = parseMatrix(target)
        const result = math.norm(m, normType as string)
        return { success: true, result: formatResult(result) }
      }

      case 'dot': {
        if (!input.vectorA || !input.vectorB) {
          return { success: false, result: null, error: '需要 vectorA 和 vectorB' }
        }
        const result = math.dot(input.vectorA, input.vectorB)
        return { success: true, result: formatResult(result) }
      }

      case 'cross': {
        if (!input.vectorA || !input.vectorB) {
          return { success: false, result: null, error: '需要 vectorA 和 vectorB' }
        }
        const result = math.cross(input.vectorA, input.vectorB)
        return { success: true, result: formatResult(result) }
      }

      case 'trace': {
        if (!input.matrix) {
          return { success: false, result: null, error: '需要 matrix' }
        }
        const m = parseMatrix(input.matrix)
        const result = math.trace(m as math.Matrix)
        return { success: true, result: formatResult(result) }
      }

      case 'svd': {
        if (!input.matrix) {
          return { success: false, result: null, error: '需要 matrix' }
        }
        const m = parseMatrix(input.matrix)
        // mathjs doesn't have built-in svd, use alternative decomposition
        // Return eigenvalue decomposition as alternative
        const eigs = math.eigs(m as math.Matrix) as unknown as {
          values: math.MathCollection
          eigenvectors: Array<{ value: number; vector: math.MathCollection }>
        }
        return {
          success: true,
          result: {
            note: 'mathjs 不支持 SVD，返回特征值分解作为替代',
            eigenvalues: formatResult(eigs.values),
            eigenvectors: eigs.eigenvectors?.map(e => ({
              value: e.value,
              vector: formatResult(e.vector)
            })) || []
          }
        }
      }

      case 'lu': {
        if (!input.matrix) {
          return { success: false, result: null, error: '需要 matrix' }
        }
        const m = parseMatrix(input.matrix)
        const result = math.lup(m as math.Matrix)
        return { success: true, result: formatResult(result) }
      }

      case 'qr': {
        if (!input.matrix) {
          return { success: false, result: null, error: '需要 matrix' }
        }
        const m = parseMatrix(input.matrix)
        const result = math.qr(m as math.Matrix)
        return { success: true, result: formatResult(result) }
      }

      case 'identity': {
        const n = input.size ?? (Array.isArray(input.matrixA) ? (input.matrixA as number[][]).length : 3)
        const size = typeof n === 'number' ? n : n[0]
        const result = math.identity(size)
        return { success: true, result: formatResult(result) }
      }

      case 'zeros': {
        const s = input.size ?? [3, 3]
        const size = typeof s === 'number' ? [s, s] : s
        const result = math.zeros(size[0], size[1])
        return { success: true, result: formatResult(result) }
      }

      case 'ones': {
        const s = input.size ?? [3, 3]
        const size = typeof s === 'number' ? [s, s] : s
        const result = math.ones(size[0], size[1])
        return { success: true, result: formatResult(result) }
      }

      case 'size': {
        if (!input.matrix) {
          return { success: false, result: null, error: '需要 matrix' }
        }
        const m = parseMatrix(input.matrix)
        const result = math.size(m)
        return { success: true, result: formatResult(result) }
      }

      case 'solve_linear': {
        if (!input.matrixA || !input.vectorB) {
          return { success: false, result: null, error: '需要 matrixA (系数矩阵) 和 vectorB (常数向量)' }
        }
        const A = parseMatrix(input.matrixA) as math.Matrix
        const b = input.vectorB
        try {
          // 首先尝试 LU 分解（对于非奇异矩阵更快）
          try {
            const result = math.lusolve(A, b) as math.Matrix
            const solution = result.toArray().map((x: math.MathType) => {
              if (typeof x === 'number') return x
              return x
            })
            return { success: true, result: { solution, method: 'LU分解' } }
          } catch {
            // LU 分解失败（奇异矩阵），使用伪逆方法（最小二乘解）
            const A_pinv = math.pinv(A) as math.Matrix
            const bMatrix = math.matrix(b.map(v => [v])) as math.Matrix
            const result = math.multiply(A_pinv, bMatrix) as math.Matrix
            const resultArray = result.toArray() as unknown as number[][]
            const solution = resultArray.map(row => {
              const val = row[0]
              return typeof val === 'number' ? val : 0
            })
            return {
              success: true,
              result: {
                solution,
                method: '伪逆（最小二乘）',
                note: '矩阵奇异，返回最小二乘近似解'
              }
            }
          }
        } catch (e) {
          return { success: false, result: null, error: `线性方程组求解失败: ${(e as Error).message}` }
        }
      }

      default:
        return { success: false, result: null, error: `未知操作: ${operation}` }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, result: null, error: `线性代数计算错误: ${message}` }
  }
}
