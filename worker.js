import { CoDriveDO } from "./CoDriveDO";

export default {
  async fetch(req, env) {
    const id = env.CODRIVE_DO.idFromName("codrive-singleton");
    const obj = env.CODRIVE_DO.get(id);
    return obj.fetch(req);
  }
};

export { CoDriveDO };
