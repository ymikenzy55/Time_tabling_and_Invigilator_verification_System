import { z } from 'zod';
import { EntityPage } from '@/components/EntityPage';
import { departmentsApi } from '@/features/academics/departmentsApi';

const createSchema = z.object({
  name: z.string().trim().min(2, 'Name is required.'),
});

const updateSchema = createSchema.partial();

const DepartmentFormFields = ({ register, errors }) => {
  return (
    <>
      <div>
        <label className="label">Name</label>
        <input className="input" {...register('name')} />
        {errors.name && <p className="field-error">{errors.name.message}</p>}
      </div>
    </>
  );
};

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'code', label: 'Code' },
  { key: '_count', label: 'Users / Courses', render: (v) => `${v?.users ?? 0} / ${v?.courses ?? 0}` },
];

export const DepartmentsPage = () => (
  <EntityPage
    title="Departments"
    description="Add and manage departments."
    queryKey="departments"
    api={departmentsApi}
    columns={columns}
    FormFields={DepartmentFormFields}
    createSchema={createSchema}
    updateSchema={updateSchema}
    createDefaultValues={{ name: '' }}
    searchPlaceholder="Search departments..."
    emptyTitle="No departments yet"
    emptyDescription="Add departments to group courses and staff."
  />
);
