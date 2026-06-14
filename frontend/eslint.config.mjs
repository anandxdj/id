import next from 'eslint-config-next';

const eslintConfig = [
  ...next,
  {
    ignores: ['.next/**', 'node_modules/**', 'src/components/ui/skiper-ui/**'],
  },
  {
    rules: {
      // Advisory perf rule (react-hooks v6). The mount-gate / one-time-init
      // patterns it flags here are intentional and safe — keep visible as warn.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];

export default eslintConfig;
