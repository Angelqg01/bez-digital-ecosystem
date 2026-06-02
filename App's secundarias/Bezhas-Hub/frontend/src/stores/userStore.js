import { create } from 'zustand';
import { ethers } from 'ethers';

const initialState = {
  userProfile: null, // Will store { username, bio, role, etc. }
  tokenBalance: '0',
  isLoggedIn: false,
  isLoading: false,
};

const useUserStore = create((set, get) => ({
  ...initialState,

  fetchUserData: async (signer, userProfileContract, tokenContract) => {
    if (!signer) {
      return get().clearUserData();
    }
    set({ isLoading: true });

    if (!userProfileContract || !tokenContract) {
      console.error("Las instancias de los contratos no se pasaron al store.");
      return;
    }

    try {
      const address = await signer.getAddress();

      // Verificar si el contrato está desplegado antes de llamar
      const provider = signer.provider;
      const contractCode = await provider.getCode(userProfileContract.target || userProfileContract.address);
      if (contractCode === '0x') {
        // Contrato no desplegado - usar valores por defecto silenciosamente
        set({
          userProfile: { username: 'Guest', bio: '', avatarUrl: '', role: 'user' },
          tokenBalance: '0',
          isLoggedIn: true,
          isAdmin: false,
          isLoading: false,
        });
        return;
      }

      const profile = await userProfileContract.getProfile(address);
      const balance = await tokenContract.balanceOf(address);
      const owner = await userProfileContract.owner();

      // Wallets autorizadas (debe coincidir con AdminRoute.jsx y useIsAdmin.js)
      const ADMIN_WALLETS_LIST = [
        '0x52Df82920CBAE522880dD7657e43d1A754eD044E',
        '0x3EfC42095E8503d41Ad8001328FC23388E00e8a3',
        '0x89c23890c742d710265dd61be789c71dc8999b12',
        '0xc0ec3b1fcb7dc0c764371919837c13b58cdc330a',
      ].map(a => a.toLowerCase());

      // Determinar si el usuario es admin (contract owner OR en lista)
      const isAdmin = address.toLowerCase() === owner.toLowerCase()
        || ADMIN_WALLETS_LIST.includes(address.toLowerCase());

      // Determinar el rol basado en diferentes criterios
      // Por defecto: user, company, professor, institution, admin
      let role = 'user';
      if (isAdmin) {
        role = 'admin';
      }
      // TODO: Aquí puedes agregar lógica adicional para determinar otros roles
      // Por ejemplo, consultando otro campo del perfil o contrato

      set({
        userProfile: {
          username: profile.username,
          bio: profile.bio,
          avatarUrl: profile.avatarUrl,
          role: role, // Agregado campo role
        },
        tokenBalance: ethers.formatEther(balance),
        isLoggedIn: true,
        isAdmin: isAdmin,
        isLoading: false,
      });
    } catch (error) {
      // Silenciar errores BAD_DATA de contratos no deployados
      if (error?.message?.includes('could not decode result data')) {
        // Silent fallback - contract not deployed in dev
        set({
          userProfile: { username: 'Guest', bio: '', avatarUrl: '', role: 'user' },
          tokenBalance: '0',
          isLoggedIn: false,
          isAdmin: false,
          isLoading: false,
        });
      } else {
        if (import.meta.env.DEV) console.error("Error al obtener los datos del usuario:", error);
        get().clearUserData(); // Limpiar el estado en caso de error
      }
    }
  },

  clearUserData: () => {
    set({ ...initialState, isLoading: false });
  },

  // Método para establecer el rol manualmente (útil para desarrollo/testing)
  setUserRole: (role) => {
    const currentProfile = get().userProfile;
    if (currentProfile) {
      set({
        userProfile: {
          ...currentProfile,
          role: role,
        },
        isAdmin: role === 'admin',
      });
    }
  },
}));

export default useUserStore;
