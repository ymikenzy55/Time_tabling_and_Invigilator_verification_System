import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export const CourseAddRedirect = () => {
  const { level } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const numeric = Number(level);
    const isValid = Number.isInteger(numeric) && numeric > 0;
    const target = isValid ? `/courses?addLevel=${numeric}` : '/courses';
    navigate(target, { replace: true });
  }, [level, navigate]);

  return null;
};
