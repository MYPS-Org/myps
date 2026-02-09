export const findProvinceByCode = (enums: any, code: any) =>
    enums?.Provinces?.find((p: any) => p.Code == code);

export const findProvinceById = (enums: any, id: any) =>
    enums?.Provinces?.find((p: any) => p.Id == id);

export const findCity = (enums: any, code: any) =>
    enums?.Cities?.find((c: any) => c.Code == code);

export const findLD = (enums: any, code: any) =>
    enums?.LDs?.find((l: any) => l.Code == code);

export const findDEO = (enums: any, code: any) =>
    enums?.DEOs?.find((d: any) => d.ProvinceCode == code);