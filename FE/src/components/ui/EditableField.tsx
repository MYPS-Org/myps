type EditableFieldProps = {
    field: string;
    isFieldEditable: (field: string) => boolean;
    children: (editable: boolean) => React.ReactNode;
};

export const EditableField: React.FC<EditableFieldProps> = ({
  field,
  isFieldEditable,
  children
}) => {
  const editable = isFieldEditable(field);
  return <>{children(editable)}</>;
};