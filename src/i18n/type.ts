export interface LanguageResource {
  common: {
    hello: string;
    hosts: string;
    or: string;
  };
  auth: {
    login: string;
    signup: string;
    terms5: string;
  };
  signin: {
    signin: string;
    rememberme: string;
    forgotpassword: string;
    signup: string;
    logout: string;
    username: string;
    password: string;
    'confirm-password': string;
    terms1: string;
    terms2: string;
    terms3: string;
    terms4: string;
    sso: string;
    or: string;
  };
  error: {
    servermalfunction: string;
    contactyourserveradmin: string;
  };
  info: {
    connectmultiplehosts: string;
    connectatleasttwohostsonanetworktobegincommunication: string;
  };
  hosts: {
    connectahost: string;
  };
}
