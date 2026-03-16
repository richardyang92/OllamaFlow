/**
 * Unit Conversion Tool using mathjs
 * Supports comprehensive unit conversions
 */
import * as math from 'mathjs'

export type UnitCategory =
  | 'length'
  | 'mass'
  | 'time'
  | 'temperature'
  | 'area'
  | 'volume'
  | 'speed'
  | 'pressure'
  | 'energy'
  | 'power'
  | 'data'
  | 'angle'

export interface MathUnitConvertInput {
  value: number
  from: string
  to: string
  category?: UnitCategory
}

export interface MathUnitConvertResult {
  success: boolean
  result?: {
    value: number
    from: string
    to: string
    fromUnit: string
    toUnit: string
    expression?: string
  }
  error?: string
}

// Unit aliases for common names
const unitAliases: Record<string, string> = {
  // Length
  'meter': 'm',
  'meters': 'm',
  'kilometer': 'km',
  'kilometers': 'km',
  'centimeter': 'cm',
  'centimeters': 'cm',
  'millimeter': 'mm',
  'millimeters': 'mm',
  'mile': 'mi',
  'miles': 'mi',
  'yard': 'yd',
  'yards': 'yd',
  'foot': 'ft',
  'feet': 'ft',
  'inch': 'in',
  'inches': 'in',
  'nmi': 'nauticalmile',
  '海里': 'nauticalmile',

  // Mass
  'kilogram': 'kg',
  'kilograms': 'kg',
  'gram': 'g',
  'grams': 'g',
  'milligram': 'mg',
  'milligrams': 'mg',
  'pound': 'lb',
  'pounds': 'lb',
  'ounce': 'oz',
  'ounces': 'oz',
  'ton': 'tonne',
  'tons': 'tonne',
  '公吨': 'tonne',

  // Time
  'second': 's',
  'seconds': 's',
  '秒': 's',
  'minute': 'min',
  'minutes': 'min',
  '分': 'min',
  'hour': 'h',
  'hours': 'h',
  '时': 'h',
  'day': 'day',
  'days': 'day',
  '天': 'day',
  'week': 'week',
  'weeks': 'week',
  '周': 'week',
  'year': 'year',
  'years': 'year',
  '年': 'year',

  // Temperature
  'celsius': 'degC',
  '摄氏度': 'degC',
  'fahrenheit': 'degF',
  '华氏度': 'degF',
  'kelvin': 'K',
  '开尔文': 'K',

  // Area
  'squaremeter': 'm2',
  'sqm': 'm2',
  '平方米': 'm2',
  'squarekilometer': 'km2',
  'sqkm': 'km2',
  '平方公里': 'km2',
  'hectare': 'ha',
  '公顷': 'ha',
  'acre': 'acre',
  '英亩': 'acre',
  'squarefoot': 'ft2',
  'sqft': 'ft2',
  '平方英尺': 'ft2',
  'squareinch': 'in2',
  'sqin': 'in2',
  '平方英寸': 'in2',

  // Volume
  'liter': 'l',
  'liters': 'l',
  '升': 'l',
  'milliliter': 'ml',
  '毫升': 'ml',
  'gallon': 'gal',
  'gallons': 'gal',
  '加仑': 'gal',
  'quart': 'qt',
  'pint': 'pt',
  'cup': 'cup',
  'cubicmeter': 'm3',
  '立方米': 'm3',
  'cubicfoot': 'ft3',
  '立方英尺': 'ft3',

  // Speed
  'mps': 'm/s',
  '米每秒': 'm/s',
  'kmh': 'km/h',
  'kph': 'km/h',
  '公里每小时': 'km/h',
  'mph': 'mi/h',
  'mileperhour': 'mi/h',
  '英里每小时': 'mi/h',
  'knot': 'knot',
  '节': 'knot',

  // Pressure
  'pascal': 'Pa',
  '帕斯卡': 'Pa',
  'kilopascal': 'kPa',
  '千帕': 'kPa',
  'bar': 'bar',
  '巴': 'bar',
  'psi': 'psi',
  '磅每平方英寸': 'psi',
  'atm': 'atm',
  '标准大气压': 'atm',

  // Energy
  'joule': 'J',
  '焦耳': 'J',
  'kilojoule': 'kJ',
  '千焦': 'kJ',
  'calorie': 'cal',
  '卡路里': 'cal',
  'kilocalorie': 'kcal',
  '千卡': 'kcal',
  'watthour': 'Wh',
  '千瓦时': 'kWh',
  'kilowatthour': 'kWh',
  '度电': 'kWh',
  'btu': 'BTU',
  '英热单位': 'BTU',

  // Power
  'watt': 'W',
  '瓦特': 'W',
  'kilowatt': 'kW',
  '千瓦': 'kW',
  'megawatt': 'MW',
  '兆瓦': 'MW',
  'horsepower': 'hp',
  '马力': 'hp',

  // Data
  'byte': 'B',
  '字节': 'B',
  'kilobyte': 'KB',
  '千字节': 'KB',
  'megabyte': 'MB',
  '兆字节': 'MB',
  'gigabyte': 'GB',
  '吉字节': 'GB',
  'terabyte': 'TB',
  '太字节': 'TB',
  'petabyte': 'PB',
  '拍字节': 'PB',

  // Angle
  'degree': 'deg',
  '度': 'deg',
  'radian': 'rad',
  '弧度': 'rad',
  'gradian': 'grad',
  '梯度': 'grad',
  'arcmin': 'arcmin',
  '角分': 'arcmin',
  'arcsec': 'arcsec',
  '角秒': 'arcsec'
}

// Custom unit definitions (for units not in mathjs)
const customUnits: Record<string, { base: string; definition: string }> = {
  'KB': { base: 'B', definition: '1024 B' },
  'MB': { base: 'B', definition: '1024 KB' },
  'GB': { base: 'B', definition: '1024 MB' },
  'TB': { base: 'B', definition: '1024 GB' },
  'PB': { base: 'B', definition: '1024 TB' }
}

/**
 * Normalize unit name
 */
function normalizeUnit(unit: string): string {
  const lower = unit.toLowerCase().replace(/[\s_-]/g, '')
  return unitAliases[lower] || unitAliases[unit] || unit
}

/**
 * Create a mathjs unit with custom definitions
 */
function createUnit(value: number, unitName: string): math.Unit | null {
  const normalized = normalizeUnit(unitName)

  try {
    // First try direct creation
    return math.unit(value, normalized) as math.Unit
  } catch {
    // Try with custom unit definition
    const customDef = customUnits[normalized.toUpperCase()] || customUnits[normalized]
    if (customDef) {
      try {
        // Create the custom unit and convert
        math.createUnit(normalized, customDef.definition, { override: true })
        return math.unit(value, normalized) as math.Unit
      } catch {
        // Unit might already exist
        try {
          return math.unit(value, normalized) as math.Unit
        } catch {
          return null
        }
      }
    }
    return null
  }
}

// Unit info helper - currently unused but kept for future use
// function _getUnitInfo(unitName: string): { name: string; symbol: string } | null {
//   const normalized = normalizeUnit(unitName)
//   try {
//     const _unit = math.unit(1, normalized) as math.Unit
//     return {
//       name: unitName,
//       symbol: normalized
//     }
//   } catch {
//     return null
//   }
// }

/**
 * Convert temperature units (special handling needed)
 */
function convertTemperature(value: number, from: string, to: string): number | null {
  const fromNorm = normalizeUnit(from)
  const toNorm = normalizeUnit(to)

  // Convert to Celsius first
  let celsius: number
  switch (fromNorm) {
    case 'degC':
    case 'C':
      celsius = value
      break
    case 'degF':
    case 'F':
      celsius = (value - 32) * 5 / 9
      break
    case 'K':
      celsius = value - 273.15
      break
    default:
      return null
  }

  // Convert from Celsius to target
  switch (toNorm) {
    case 'degC':
    case 'C':
      return celsius
    case 'degF':
    case 'F':
      return celsius * 9 / 5 + 32
    case 'K':
      return celsius + 273.15
    default:
      return null
  }
}

/**
 * Convert data units (binary prefixes)
 */
function convertDataUnits(value: number, from: string, to: string): number | null {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']

  const fromNorm = normalizeUnit(from).toUpperCase()
  const toNorm = normalizeUnit(to).toUpperCase()

  const fromIndex = units.indexOf(fromNorm)
  const toIndex = units.indexOf(toNorm)

  if (fromIndex === -1 || toIndex === -1) return null

  const diff = fromIndex - toIndex
  return value * Math.pow(1024, diff)
}

export function mathUnitConvert(input: MathUnitConvertInput): MathUnitConvertResult {
  try {
    const { value, from, to } = input

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return { success: false, error: 'value 必须是有效数字' }
    }

    if (!from || !to) {
      return { success: false, error: '需要 from 和 to 单位' }
    }

    const fromNorm = normalizeUnit(from)
    const toNorm = normalizeUnit(to)

    // Special handling for temperature
    const tempUnits = ['degC', 'C', 'degF', 'F', 'K']
    if (tempUnits.includes(fromNorm) && tempUnits.includes(toNorm)) {
      const result = convertTemperature(value, from, to)
      if (result !== null) {
        return {
          success: true,
          result: {
            value: parseFloat(result.toPrecision(12)),
            from,
            to,
            fromUnit: fromNorm,
            toUnit: toNorm
          }
        }
      }
    }

    // Special handling for data units
    const dataUnits = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
    if (dataUnits.includes(fromNorm.toUpperCase()) && dataUnits.includes(toNorm.toUpperCase())) {
      const result = convertDataUnits(value, from, to)
      if (result !== null) {
        return {
          success: true,
          result: {
            value: parseFloat(result.toPrecision(12)),
            from,
            to,
            fromUnit: fromNorm.toUpperCase(),
            toUnit: toNorm.toUpperCase()
          }
        }
      }
    }

    // General unit conversion using mathjs
    const unit = createUnit(value, from)
    if (!unit) {
      return { success: false, error: `无法识别的单位: ${from}` }
    }

    try {
      const converted = unit.to(toNorm) as math.Unit
      const resultValue = converted.toNumber()

      return {
        success: true,
        result: {
          value: parseFloat(resultValue.toPrecision(12)),
          from,
          to,
          fromUnit: fromNorm,
          toUnit: toNorm,
          expression: `${value} ${from} = ${parseFloat(resultValue.toPrecision(12))} ${to}`
        }
      }
    } catch {
      return { success: false, error: `无法从 ${from} 转换到 ${to}` }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: `单位转换错误: ${message}` }
  }
}

/**
 * Parse unit expression like "100 km to mile" or "100 km in mile"
 */
export function parseUnitExpression(expression: string): MathUnitConvertInput | null {
  // Try to parse "value unit to/in unit" format
  const match = expression.match(/^\s*([\d.]+)\s*(\w+)\s+(?:to|in|=>)\s+(\w+)\s*$/i)
  if (match) {
    const value = parseFloat(match[1])
    const from = match[2]
    const to = match[3]
    if (!isNaN(value)) {
      return { value, from, to }
    }
  }
  return null
}
