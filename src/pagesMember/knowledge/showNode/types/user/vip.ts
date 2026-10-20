// src/types/user/vip.ts
export interface VipInfo {
  isVip: boolean;
  level: 'basic' | 'premium' | 'enterprise';
  expireDate: string;
  startDate: string;
  autoRenew: boolean;
  features: VipFeature[];
}

export interface VipFeature {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface VipPlan {
  id: string;
  name: string;
  level: 'basic' | 'premium' | 'enterprise';
  price: number;
  currency: string;
  duration: number; // 月份
  features: VipFeature[];
  popular?: boolean;
}

export interface VipPurchaseRequest {
  plan_id: string;
  payment_method: 'wechat' | 'alipay' | 'card';
  auto_renew?: boolean;
}

export interface VipPurchaseResponse {
  order_id: string;
  payment_url: string;
  amount: number;
  currency: string;
}
