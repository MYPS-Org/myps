export type DropDownOption = {
    label: string;
    value: string | number;
};

export type DropDownFilter = {
    options: DropDownOption[];
    onChange: (value: string | number) => void;
    placeholder?: string;
};