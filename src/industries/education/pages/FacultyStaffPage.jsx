import { Briefcase } from 'lucide-react';
import SectionPage from '@/industries/education/components/SectionPage';

export default function FacultyStaffPage() {
  return (
    <SectionPage
      section="faculty"
      title="Faculty & Staff"
      description="Teacher and staff management analytics"
      icon={Briefcase}
    />
  );
}