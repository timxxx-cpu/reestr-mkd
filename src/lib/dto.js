/**
 * Централизованные DTO-типы для границы UI <-> API <-> DB (JSDoc).
 */

/**
 * @typedef {Object} DbFloorRow
 * @property {string} id
 * @property {string} block_id
 * @property {string} floor_key
 * @property {string} [label]
 * @property {number} [index]
 * @property {string} [floor_type]
 * @property {number} [height]
 * @property {number} [area_proj]
 * @property {number} [area_fact]
 * @property {boolean} [is_duplex]
 * @property {number|null} [parent_floor_index]
 * @property {string|null} [basement_id]
 * @property {boolean} [is_technical]
 * @property {boolean} [is_commercial]
 * @property {boolean} [is_stylobate]
 * @property {boolean} [is_basement]
 * @property {boolean} [is_attic]
 * @property {boolean} [is_loft]
 * @property {boolean} [is_roof]
 */

/**
 * @typedef {Object} UiFloor
 * @property {string} id
 * @property {string} buildingId
 * @property {string} blockId
 * @property {string} floorKey
 * @property {string} [label]
 * @property {string} [type]
 * @property {number} [index]
 * @property {number} [height]
 * @property {number} [areaProj]
 * @property {number} [areaFact]
 * @property {boolean} [isDuplex]
 */

/**
 * @typedef {Object} DbUnitRow
 * @property {string} id
 * @property {string} [number]
 * @property {string} [unit_type]
 * @property {number} [total_area]
 * @property {number} [living_area]
 * @property {number} [useful_area]
 * @property {number} [rooms_count]
 * @property {string} [status]
 * @property {string} [cadastre_number]
 * @property {string} [floor_id]
 * @property {string} [entrance_id]
 */

/**
 * @typedef {Object} DbMopRow
 * @property {string} id
 * @property {string} [type]
 * @property {number} [area]
 * @property {string} [floor_id]
 * @property {string} [entrance_id]
 */

export {};
