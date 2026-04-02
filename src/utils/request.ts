// 定义快捷方法的Options类型（显式列出允许的属性）
type RequestShortcutOptions = {
  showLoading?: boolean;
  loadingText?: string;
  params?: any; // 显式包含params
  header?: any;
  timeout?: number;
  dataType?: string;
  responseType?: string;
  sslVerify?: boolean;
  withCredentials?: boolean;
  firstIpv4?: boolean;
};

// 1. 先定义UI提示函数
const showToast = (title: string, icon: 'success' | 'error' | 'none' = 'none') => {
  uni.showToast({ title, icon, duration: 2000 });
};

const showLoading = (title = '加载中...') => {
  uni.showLoading({ title, mask: true });
};

const hideLoading = () => {
  uni.hideLoading();
};

export const baseURL = 'https://youupro.xyz';

// 2. 扩展RequestOptions类型
type CustomRequestOptions = UniApp.RequestOptions & {
  showLoading?: boolean;
  loadingText?: string;
  params?: any; // 支持GET请求的URL参数
};

// 定义uni.request的返回类型
type UniRequestResult = Promise<[UniApp.GeneralCallbackResult, UniApp.RequestSuccessCallbackResult | undefined]>;

/**
 * 封装uni.request
 */
const requestPromise = (options: UniApp.RequestOptions): UniRequestResult => {
  return new Promise((resolve) => {
    uni.request({
      ...options,
      success: (res) => {
        // 成功时返回符合GeneralCallbackResult的对象（errMsg为空字符串）
        resolve([{ errMsg: '' }, res]);
      },
      fail: (err) => {
        // 失败时直接返回原生err（包含errMsg）
        resolve([err, undefined]);
      }
    });
  });
};

/**
 * 请求拦截（移除loading相关逻辑，避免重复显示）
 */
const requestInterceptor = (config: CustomRequestOptions) => {
  // 核心修改1：移除拦截器中的showLoading，统一在request函数中处理
  const token = uni.getStorageSync('accessToken');
  if (token) {
    config.header = {
      ...config.header,
      'Authorization': `JWT ${token}`,
      'content-type': 'application/json'
    };
  }

  if (config.url && !config.url.startsWith('http')) {
    config.url = baseURL + config.url;
  }

  return config;
};

/**
 * 响应拦截（移除loading相关逻辑，避免重复隐藏）
 */
const responseInterceptor = async (
  response: UniApp.RequestSuccessCallbackResult | undefined,
  originalConfig: CustomRequestOptions
) => {
  // 核心修改2：移除拦截器中的hideLoading，统一在request函数中处理
  if (!response) {
    showToast('请求失败，请检查网络');
    return Promise.reject(new Error('请求失败'));
  }

  if (response.statusCode === 401) {
    const refreshToken = uni.getStorageSync('refreshToken');
    if (!refreshToken) {
      logout();
      return Promise.reject(new Error('请重新登录'));
    }

    try {
      const userInfo = uni.getStorageSync('userInfo')
      const accessToken = uni.getStorageSync('accessToken')

      if (!userInfo || !accessToken) {
        console.warn('请登录进行站内搜索')
        uni.navigateTo({ url: '/pagesMember/login/login' })
        return Promise.reject(new Error('未登录')); // 显式返回reject，避免逻辑穿透
      }

      // 刷新Token时隐藏主请求的loading（避免刷新过程中loading一直显示）
      if (originalConfig.showLoading !== false) {
        hideLoading();
      }

      const [refreshErr, refreshRes] = await requestPromise({
        url: `${baseURL}/api/v1/token/refresh/`,
        method: 'POST',
        data: { refresh: refreshToken },
        header: {
          'content-type': 'application/json',
          Authorization: `JWT ${accessToken}`,
        }
      });

      if (refreshErr.errMsg) {
        throw new Error('刷新Token请求失败');
      }

      if (refreshRes && refreshRes.statusCode === 200) {
        const refreshData = refreshRes.data as { access: string; refresh?: string };
        const { access } = refreshData;
        uni.setStorageSync('accessToken', access);

        if (refreshData.refresh) {
          uni.setStorageSync('refreshToken', refreshData.refresh);
        }

        // 重试原请求前，重新显示loading（如果需要）
        if (originalConfig.showLoading !== false) {
          showLoading(originalConfig.loadingText || '加载中...');
        }

        const retryConfig = {
          ...originalConfig,
          header: {
            ...originalConfig.header,
            'Authorization': `JWT ${access}`,
            'content-type': 'application/json'
          }
        };

        const [retryErr, retryRes] = await requestPromise(retryConfig);
        if (retryErr.errMsg) {
          throw new Error('重试请求失败');
        }

        return retryRes; // 返回重试后的响应数据
      } else {
        console.error('Token刷新失败：', refreshRes?.data); // 调试用，可删除
        logout();
        return Promise.reject(new Error('登录已过期，请重新登录'));
      }
    } catch (err) {
      console.error('Token刷新请求异常：', err); // 调试用，可删除
      logout();
      return Promise.reject(new Error('登录已过期，请重新登录'));
    }
  }

  // 处理其他错误（优化错误提示）
  if (response.statusCode >= 400 && response.statusCode !== 401) {
    let errMsg = `请求失败（${response.statusCode}）`;
    // 适配DRF的错误格式（detail字段）
    if (typeof response.data === 'object' && response.data !== null) {
      errMsg = (response.data as { detail?: string }).detail || errMsg;
    } else if (typeof response.data === 'string') {
      errMsg = response.data;
    }
    showToast(errMsg);
    return Promise.reject(new Error(errMsg));
  }

  return response;
};

/**
 * 退出登录
 */
export const logout = () => {
  // 清除的键名和读取/存储一致
  uni.removeStorageSync('accessToken');
  uni.removeStorageSync('refreshToken');
  uni.removeStorageSync('userInfo');
  uni.removeStorageSync('kbActiveTab');
  uni.removeStorageSync('selectedKbId_right');
  uni.redirectTo({ url: '/pagesMember/login/login' });
  showToast('登录已过期，请重新登录');
};

/**
 * 统一请求方法（确保loading严格配对）
 */
export const request = async <T = any>(options: CustomRequestOptions): Promise<T> => {
  const config = requestInterceptor(options);
  let loadingShown = false; // 严格标记loading是否显示

  try {
    // 唯一显示loading的地方：仅当需要显示时调用一次
    if (config.showLoading !== false) {
      showLoading(config.loadingText || '加载中...');
      loadingShown = true; // 标记为已显示
    }

    // 合并params和data（修复扩展运算符报错）
    const params = config.params ?? {};
    const data = config.data ?? {};
    const requestData = config.method === 'GET'
      ? Object.assign({}, params, data)
      : config.data;

    const [err, response] = await requestPromise({
      ...config,
      data: requestData
    });

    // 处理请求失败
    if (err.errMsg) {
      throw new Error(err.errMsg);
    }
    const processedResponse = await responseInterceptor(response, config);
    return (processedResponse as UniApp.RequestSuccessCallbackResult).data as T;
  } catch (error) {
    // 错误时：如果loading已显示，仅隐藏一次
    if (loadingShown) {
      hideLoading();
      loadingShown = false; // 标记为已隐藏
    }
    const errMsg = error instanceof Error ? error.message : '请求失败';
    uni.showToast({ title: errMsg, icon: 'none' });
    throw error;
  } finally {
    // 最终兜底：确保loading一定隐藏（防止分支漏隐藏）
    if (loadingShown) {
      hideLoading();
      loadingShown = false;
    }
  }
};

// 快捷方法
export const get = <T = any>(
  url: string,
  data?: any,
  options: RequestShortcutOptions = {}
) => request<T>({ url, method: 'GET', data, ...options });

export const post = <T = any>(
  url: string,
  data?: any,
  options: RequestShortcutOptions = {}
) => request<T>({ url, method: 'POST', data, ...options });
