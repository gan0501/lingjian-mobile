const FIELD_MAP: Record<number, {
  name: string[];
  constructor: string[];
  scale: string[];
  address: string[];
  publishTime: string[];
  region: string[];
}> = {
  1: { name: ['project_name'], constructor: ['building_company_name'], scale: ['area'], address: ['project_address', 'city'], publishTime: ['publish_time'], region: ['region_name'] },
  2: { name: ['resource_name', 'project_name'], constructor: ['the_unit'], scale: ['transfer_area', 'land_area'], address: ['resource_location', 'city'], publishTime: ['announcement_pub_time'], region: ['region_name'] },
  3: { name: ['project_name', 'project_no'], constructor: ['developer_company_name'], scale: ['project_cost'], address: ['project_address', 'city'], publishTime: ['publish_time_1', 'publish_time_4'], region: ['region_name'] },
  4: { name: ['project_name'], constructor: ['purchaser_name', 'purchasing_unit'], scale: ['budget_amount', 'procurement_budget'], address: ['purchaser_address', 'project_address'], publishTime: ['publish_time_1', 'publish_time_4', 'publish_time_3', 'create_time'], region: ['region_name', 'province'] },
  5: { name: ['project_name'], constructor: ['builder', 'constructor', 'building_company_name'], scale: ['area'], address: ['project_address', 'address'], publishTime: ['created_at'], region: ['region_name', 'city'] },
};

const getFirstValid = (data: any, fields: string[]): string => {
  for (const field of fields) {
    const val = data[field];
    if (val !== null && val !== undefined && val !== '' && val !== '-') return String(val).trim();
  }
  return '-';
};

const formatScale = (type: number, value: string): string => {
  if (value === '-') return '-';
  if (type === 3) {
    const num = parseFloat(value.replace(/,/g, ''));
    if (isNaN(num)) return value;
    if (num >= 100000000) return (num / 100000000).toFixed(2) + '亿元';
    if (num >= 10000) return (num / 10000).toFixed(2) + '万元';
    return num.toLocaleString() + '元';
  }
  if (type === 5) return value;
  const num = parseFloat(value);
  return isNaN(num) ? value : `${num}㎡`;
};

const formatDate = (value: string): string => {
  if (!value || value === '-') return '-';
  const date = new Date(value);
  return isNaN(date.getTime()) ? value : date.toLocaleDateString('zh-CN');
};

export const extractProjectDetails = (data: any, type: number) => {
  const fields = FIELD_MAP[type];
  if (!fields) return null;
  const source = data.project_category === 'followed' || data.project_category === 'collaborated'
    ? { ...data.related_entities_data, ...data }
    : data;
  return {
    name: getFirstValid(source, fields.name),
    type,
    constructor: getFirstValid(source, fields.constructor),
    scale: formatScale(type, getFirstValid(source, fields.scale)),
    address: getFirstValid(source, fields.address),
    publishTime: formatDate(getFirstValid(source, fields.publishTime)),
    region: getFirstValid(source, fields.region),
  };
};
