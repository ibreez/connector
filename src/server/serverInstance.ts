import { BmlTransactionConnector } from '../connector/bmlConnector';
import { RealBmlAdapter } from '../connector/realBmlAdapter';
import { createBmlApiRouter } from './bmlApiRouter';

// Live Bank of Maldives Real Adapter Instance
export const realBmlAdapter = new RealBmlAdapter();
export const bmlConnector = new BmlTransactionConnector(realBmlAdapter, 60);
export const bmlApiRouter = createBmlApiRouter(bmlConnector);
