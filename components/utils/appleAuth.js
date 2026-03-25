// app/auth/appleAuth.js
import {
  AppleAuthRequestScope,
  AppleAuthRequestOperation,
  appleAuth,
} from "@invertase/react-native-apple-authentication";

export async function appleLogin() {
  try {
    const appleAuthRequestResponse = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      // Note: it appears putting FULL_NAME first is important, see issue #293
      requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
    });

    // get current authentication state for user
    // /!\ This method must be tested on a real device. On the iOS simulator it always throws an error.
    const credentialState = await appleAuth.getCredentialStateForUser(appleAuthRequestResponse.user);

    // use credentialState response to ensure the user is authenticated
    if (credentialState === appleAuth.State.AUTHORIZED) {
      // user is authenticated
    }

    const { identityToken, authorizationCode, user } = appleAuthRequestResponse;
    if (identityToken) {
      const payload = parseJwt(identityToken);
      console.log('Apple ID Token Payload:', payload);
      console.log('aud:', payload?.aud);
      return {
        idToken: identityToken,
        authorizationCode: authorizationCode ? String(authorizationCode) : undefined,
        user: user ? String(user) : undefined,
      };
    }

    console.warn('無法取得 Apple identityToken');
    return null;
  } catch (error) {
    console.error("Apple login error:", error);
    return null;
  }
}

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );

    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('解析 id_token 失敗', e);
    return null;
  }
}
