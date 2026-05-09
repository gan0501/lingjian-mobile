import { authService } from '@/services/authService';

let navigation: any = null;

export const setNavigationRef = (nav: any) => {
  navigation = nav;
};

export const getNavigationRef = () => navigation;

export const handleTokenExpired = () => {
  authService.logout();
};
