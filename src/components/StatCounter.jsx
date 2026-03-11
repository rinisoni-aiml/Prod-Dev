import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import CountUp from 'react-countup';

const StatCounter = ({ value, suffix = '', prefix = '', label, decimals = 0 }) => {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.3 });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }} className="text-center">
      <div className="text-3xl md:text-4xl font-bold text-foreground">
        {prefix}{inView && <CountUp end={value} duration={2} decimals={decimals} />}{suffix}
      </div>
      <div className="text-sm text-foreground-secondary mt-1">{label}</div>
    </motion.div>
  );
};
export default StatCounter;
