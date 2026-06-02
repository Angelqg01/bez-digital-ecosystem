
import { useMemo } from 'react';

export function useProfileModules(profileType: string) {
  const modules = useMemo(() => {
    switch (profileType) {
      case 'retail':
        return ['staking', 'portfolio', 'rewards', 'agent'];
      case 'private-investor':
        return ['staking', 'portfolio', 'rewards', 'agent', 'governance'];
      case 'whale':
        return ['staking', 'portfolio', 'rewards', 'agent', 'governance', 'otc'];
      case 'institution':
        return ['staking', 'portfolio', 'rewards', 'agent', 'governance', 'compliance', 'custody'];
      case 'government':
        return ['staking', 'portfolio', 'rewards', 'agent', 'governance', 'compliance', 'transparency'];
      default:
        return ['staking', 'portfolio', 'rewards', 'agent'];
    }
  }, [profileType]);

  return {
    modules,
    hasModule: (moduleName: string) => modules.includes(moduleName)
  };
}
