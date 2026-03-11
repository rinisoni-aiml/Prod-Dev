import LandingNav from '@/components/landing/LandingNav';
import HeroSection from '@/components/landing/HeroSection';
import LandingSections from '@/components/landing/LandingSections';
import Footer from '@/components/landing/Footer';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <HeroSection />
      <LandingSections />
      <Footer />
    </div>
  );
};

export default LandingPage;
