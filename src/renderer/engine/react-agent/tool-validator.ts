/**
 * Tool Validator for Agent Execution
 * Validates tool parameters before execution to reduce invalid API calls
 */

export interface ToolParamProperty {
  type?: string | string[]
  description?: string
  enum?: string[]
  items?: ToolParamProperty
  properties?: Record<string, ToolParamProperty>
  required?: string[]
}

export interface ToolParamSchema {
  type: string
  properties: Record<string, ToolParamProperty>
  required: string[]
}

export interface ValidationError {
  field: string
  message: string
  severity: 'error' | 'warning'
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
}

const TYPE_VALIDATORS: Record<string, (value: unknown) => boolean> = {
  string: (v) => typeof v === 'string',
  number: (v) => typeof v === 'number' && !isNaN(v),
  integer: (v) => typeof v === 'number' && Number.isInteger(v),
  boolean: (v) => typeof v === 'boolean',
  array: (v) => Array.isArray(v),
  object: (v) => typeof v === 'object' && v !== null && !Array.isArray(v),
}

function checkType(value: unknown, expectedType: string | string[]): boolean {
  const types = Array.isArray(expectedType) ? expectedType : [expectedType]
  return types.some((t) => {
    const validator = TYPE_VALIDATORS[t.toLowerCase()]
    return validator ? validator(value) : true
  })
}

function validateRequired(
  params: Record<string, unknown>,
  required: string[]
): ValidationError[] {
  const errors: ValidationError[] = []
  
  for (const field of required) {
    if (params[field] === undefined || params[field] === null) {
      errors.push({
        field,
        message: `必填字段 "${field}" 缺失`,
        severity: 'error',
      })
    } else if (typeof params[field] === 'string' && params[field].trim() === '') {
      errors.push({
        field,
        message: `必填字段 "${field}" 不能为空字符串`,
        severity: 'error',
      })
    }
  }
  
  return errors
}

function validateFieldType(
  value: unknown,
  field: string,
  property: ToolParamProperty
): ValidationError[] {
  const errors: ValidationError[] = []
  
  if (value === undefined || value === null) {
    return errors
  }
  
  if (property.type && !checkType(value, property.type)) {
    const expectedTypes = Array.isArray(property.type) ? property.type.join(' | ') : property.type
    errors.push({
      field,
      message: `字段 "${field}" 类型错误，期望 ${expectedTypes}，实际为 ${typeof value}`,
      severity: 'error',
    })
  }
  
  if (property.enum && !property.enum.includes(String(value))) {
    errors.push({
      field,
      message: `字段 "${field}" 值 "${value}" 不在允许的枚举值中 [${property.enum.join(', ')}]`,
      severity: 'error',
    })
  }
  
  if (property.type === 'array' && Array.isArray(value) && property.items) {
    value.forEach((item, index) => {
      if (property.items!.type && !checkType(item, property.items!.type)) {
        errors.push({
          field: `${field}[${index}]`,
          message: `数组元素类型错误，期望 ${property.items!.type}`,
          severity: 'error',
        })
      }
      if (property.items!.properties && typeof item === 'object' && item !== null) {
        const itemErrors = validateObjectProperties(
          item as Record<string, unknown>,
          property.items!.properties,
          property.items!.required || [],
          `${field}[${index}].`
        )
        errors.push(...itemErrors)
      }
    })
  }
  
  if (property.type === 'object' && property.properties && typeof value === 'object' && value !== null) {
    const nestedErrors = validateObjectProperties(
      value as Record<string, unknown>,
      property.properties,
      property.required || [],
      `${field}.`
    )
    errors.push(...nestedErrors)
  }
  
  return errors
}

function validateObjectProperties(
  params: Record<string, unknown>,
  properties: Record<string, ToolParamProperty>,
  required: string[],
  prefix: string = ''
): ValidationError[] {
  const errors: ValidationError[] = []
  
  errors.push(...validateRequired(params, required))
  
  for (const [field, property] of Object.entries(properties)) {
    const value = params[field]
    const fullField = prefix + field
    const fieldErrors = validateFieldType(value, fullField, property)
    errors.push(...fieldErrors)
  }
  
  return errors
}

export function validateToolParams(
  toolName: string,
  params: Record<string, unknown>,
  schema: ToolParamSchema
): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []
  
  errors.push(...validateRequired(params, schema.required))
  
  for (const [field, property] of Object.entries(schema.properties)) {
    const value = params[field]
    const fieldErrors = validateFieldType(value, field, property)
    errors.push(...fieldErrors.filter((e) => e.severity === 'error'))
    warnings.push(...fieldErrors.filter((e) => e.severity === 'warning'))
  }
  
  const unknownFields = Object.keys(params).filter(
    (key) => !schema.properties[key]
  )
  
  for (const field of unknownFields) {
    warnings.push({
      field,
      message: `未知字段 "${field}" 将被忽略`,
      severity: 'warning',
    })
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

export function formatValidationErrors(result: ValidationResult): string {
  const parts: string[] = []
  
  if (result.errors.length > 0) {
    parts.push('验证错误:')
    result.errors.forEach((e) => parts.push(`  - ${e.message}`))
  }
  
  if (result.warnings.length > 0) {
    parts.push('验证警告:')
    result.warnings.forEach((w) => parts.push(`  - ${w.message}`))
  }
  
  return parts.join('\n')
}

export const COMMON_TOOL_SCHEMAS: Record<string, ToolParamSchema> = {
  todos: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['init', 'add', 'complete', 'list', 'remove', 'clear'],
        description: '操作类型',
      },
      tasks: {
        type: 'array',
        items: { type: 'string' },
        description: '任务列表',
      },
      content: {
        type: 'string',
        description: '任务内容',
      },
      taskId: {
        type: 'string',
        description: '任务ID',
      },
    },
    required: ['action'],
  },
  readFile: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: '文件路径',
      },
    },
    required: ['filePath'],
  },
  writeFile: {
    type: 'object',
    properties: {
      filename: {
        type: 'string',
        description: '文件名',
      },
      content: {
        type: 'string',
        description: '文件内容',
      },
    },
    required: ['filename', 'content'],
  },
  executeCommand: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Shell 命令',
      },
    },
    required: ['command'],
  },
  httpRequest: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: '请求URL',
      },
      method: {
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        description: 'HTTP方法',
      },
      headers: {
        type: 'object',
        description: '请求头',
      },
      body: {
        type: ['string', 'object'],
        description: '请求体',
      },
    },
    required: ['url'],
  },
  writeMultipleFiles: {
    type: 'object',
    properties: {
      files: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            filename: { type: 'string' },
            content: { type: 'string' },
          },
          required: ['filename', 'content'],
        },
        description: '文件列表',
      },
    },
    required: ['files'],
  },
  executePython: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'Python 代码',
      },
      saveAs: {
        type: 'string',
        description: '保存为文件名',
      },
    },
    required: ['code'],
  },
  webSearch: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索关键词',
      },
      maxResults: {
        type: 'number',
        description: '最大结果数',
      },
      engines: {
        type: 'array',
        items: { type: 'string' },
        description: '搜索引擎列表',
      },
      timeRange: {
        type: 'string',
        enum: ['day', 'week', 'month', 'year'],
        description: '时间范围',
      },
    },
    required: ['query'],
  },
}

export function getToolSchema(toolName: string): ToolParamSchema | null {
  const normalizedName = toolName.replace(/^browser_/, '')
  return COMMON_TOOL_SCHEMAS[toolName] || COMMON_TOOL_SCHEMAS[normalizedName] || null
}

export function suggestFix(
  toolName: string,
  params: Record<string, unknown>,
  result: ValidationResult
): string | null {
  if (result.valid) return null
  
  const suggestions: string[] = []
  
  for (const error of result.errors) {
    if (error.message.includes('缺失') || error.message.includes('不能为空')) {
      suggestions.push(`请提供 ${error.field} 参数`)
    } else if (error.message.includes('类型错误')) {
      suggestions.push(`请检查 ${error.field} 的类型是否正确`)
    } else if (error.message.includes('枚举值')) {
      suggestions.push(`${error.field} 只能是特定的值之一`)
    }
  }
  
  return suggestions.length > 0 ? suggestions.join('; ') : null
}
