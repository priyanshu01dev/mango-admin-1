import React, { useState } from 'react';
import { ANDROID_API_ENDPOINTS } from '../data/mockData';
import { ApiEndpointSpec } from '../types';
import {
  Terminal,
  Play,
  Copy,
  Check,
  Smartphone,
  Server,
  Database,
  Code2,
  FileCode,
  Layers,
  ArrowRight
} from 'lucide-react';

export const AndroidApiExplorer: React.FC = () => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpointSpec>(ANDROID_API_ENDPOINTS[0]);
  const [activeTab, setActiveTab] = useState<'SANDBOX' | 'KOTLIN' | 'MONGO'>('SANDBOX');
  const [simulatedResponse, setSimulatedResponse] = useState<any>(ANDROID_API_ENDPOINTS[0].responseSample);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRunEndpoint = () => {
    setIsLoading(true);
    setTimeout(() => {
      setSimulatedResponse(selectedEndpoint.responseSample);
      setIsLoading(false);
    }, 280);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const kotlinSampleCode = `// Android Studio - Kotlin Retrofit Interface
// File: src/main/java/com/gimbooks/app/network/BillingApiService.kt

package com.gimbooks.app.network

import retrofit2.Response
import retrofit2.http.*

interface BillingApiService {

    @POST("/api/v1/auth/login")
    suspend fun login(
        @Body request: LoginRequest
    ): Response<AuthResponse>

    @GET("/api/v1/invoices")
    suspend fun getInvoices(
        @Header("Authorization") token: String,
        @Query("page") page: Int = 1,
        @Query("status") status: String? = null
    ): Response<InvoiceListResponse>

    @POST("/api/v1/invoices")
    suspend fun createInvoice(
        @Header("Authorization") token: String,
        @Body invoice: CreateInvoiceRequest
    ): Response<InvoiceCreateResponse>

    @GET("/api/v1/inventory")
    suspend fun getInventory(
        @Header("Authorization") token: String
    ): Response<InventoryResponse>

    @POST("/api/v1/eway-bill/generate")
    suspend fun generateEWayBill(
        @Header("Authorization") token: String,
        @Body request: EWayBillRequest
    ): Response<EWayBillResponse>

    @POST("/api/v1/payments")
    suspend fun recordPayment(
        @Header("Authorization") token: String,
        @Body request: PaymentRequest
    ): Response<PaymentResponse>
}

// Data Classes for Android Studio
data class CreateInvoiceRequest(
    val customerId: String,
    val invoiceDate: String,
    val dueDate: String,
    val items: List<InvoiceItemDto>,
    val notes: String?
)

data class InvoiceItemDto(
    val productId: String,
    val quantity: Double,
    val unit: String,
    val price: Double,
    val discountPercent: Double,
    val gstRate: Double
)`;

  const mongoSchemaCode = `// Node.js + Express + MongoDB Mongoose Schemas
// File: src/models/Invoice.js

const mongoose = require('mongoose');

const InvoiceItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: { type: String, required: true },
  hsnCode: { type: String, required: true },
  quantity: { type: Number, required: true },
  unit: { type: String, default: 'PCS' },
  price: { type: Number, required: true },
  discountPercent: { type: Number, default: 0 },
  gstRate: { type: Number, required: true }, // 0, 5, 12, 18, 28
  taxableAmount: { type: Number, required: true },
  cgstAmount: { type: Number, default: 0 },
  sgstAmount: { type: Number, default: 0 },
  igstAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true }
});

const InvoiceSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  invoiceNumber: { type: String, required: true, unique: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party' },
  customerName: { type: String, required: true },
  customerGstin: { type: String },
  customerStateCode: { type: String, required: true },
  isInterState: { type: Boolean, default: false },
  items: [InvoiceItemSchema],
  taxableTotal: { type: Number, required: true },
  cgstTotal: { type: Number, default: 0 },
  sgstTotal: { type: Number, default: 0 },
  igstTotal: { type: Number, default: 0 },
  grandTotal: { type: Number, required: true },
  amountPaid: { type: Number, default: 0 },
  balanceDue: { type: Number, required: true },
  status: { type: String, enum: ['PAID', 'UNPAID', 'PARTIALLY_PAID', 'CANCELLED'], default: 'UNPAID' },
  irnNumber: { type: String },
  eWayBillNumber: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Invoice', InvoiceSchema);`;

  return (
    <div className="space-y-6">
      {/* Top Banner & Architecture Blueprint */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <Terminal className="w-5 h-5 text-indigo-400" />
              <h2 className="text-xl font-black text-white">Android Billing App REST API & Backend Suite</h2>
            </div>
            <p className="text-slate-400 text-xs mt-0.5">
              RESTful endpoints, real-time testing console, Kotlin Retrofit code for Android Studio, and MongoDB schemas.
            </p>
          </div>

          <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setActiveTab('SANDBOX')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'SANDBOX' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Interactive API Sandbox</span>
            </button>
            <button
              onClick={() => setActiveTab('KOTLIN')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'KOTLIN' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Android Studio (Kotlin)</span>
            </button>
            <button
              onClick={() => setActiveTab('MONGO')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'MONGO' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>MongoDB Mongoose Models</span>
            </button>
          </div>
        </div>

        {/* 3-Tier Architecture Diagram */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-slate-800/50 border border-slate-700/60 p-3 rounded-xl flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Frontend App</span>
              <div className="font-bold text-white text-xs">Android Billing App</div>
              <p className="text-[10px] text-slate-400">Kotlin, Retrofit, Jetpack Compose</p>
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/60 p-3 rounded-xl flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Backend API Server</span>
              <div className="font-bold text-white text-xs">Node.js + Express</div>
              <p className="text-[10px] text-slate-400">JWT Auth, GST Engine, E-Way Wrapper</p>
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/60 p-3 rounded-xl flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-teal-400 font-bold uppercase tracking-wider">Database Layer</span>
              <div className="font-bold text-white text-xs">MongoDB Database</div>
              <p className="text-[10px] text-slate-400">Multi-tenant business collections</p>
            </div>
          </div>
        </div>
      </div>

      {/* TAB 1: INTERACTIVE API SANDBOX */}
      {activeTab === 'SANDBOX' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Endpoint List (4 cols) */}
          <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-2">
              Available REST Endpoints
            </span>
            <div className="space-y-1">
              {ANDROID_API_ENDPOINTS.map(ep => {
                const isSelected = selectedEndpoint.path === ep.path && selectedEndpoint.method === ep.method;
                return (
                  <button
                    key={ep.method + ep.path}
                    onClick={() => {
                      setSelectedEndpoint(ep);
                      setSimulatedResponse(ep.responseSample);
                    }}
                    className={`w-full text-left p-3 rounded-xl text-xs transition-colors border ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                        : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span
                        className={`font-mono font-black text-[10px] px-1.5 py-0.5 rounded ${
                          ep.method === 'POST' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'
                        }`}
                      >
                        {ep.method}
                      </span>
                      <span className="font-mono text-slate-200 truncate">{ep.path}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{ep.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Endpoint Test Console (8 cols) */}
          <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            {/* Endpoint header */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <span className="font-mono font-black text-xs px-2 py-1 rounded bg-indigo-500/20 text-indigo-400">
                  {selectedEndpoint.method}
                </span>
                <span className="font-mono font-bold text-white text-sm">{selectedEndpoint.path}</span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() =>
                    copyToClipboard(
                      `curl -X ${selectedEndpoint.method} "https://api.gimbooks.com${selectedEndpoint.path}" -H "Content-Type: application/json"`
                    )
                  }
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied cURL' : 'Copy cURL'}</span>
                </button>

                <button
                  onClick={handleRunEndpoint}
                  disabled={isLoading}
                  className="flex items-center space-x-1.5 px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-md shadow-emerald-500/20"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{isLoading ? 'Sending...' : 'Send Test Request'}</span>
                </button>
              </div>
            </div>

            {/* Headers */}
            <div className="text-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Headers</span>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 mt-1">
                {Object.entries(selectedEndpoint.headers).map(([k, v]) => (
                  <div key={k}>
                    <span className="text-indigo-400">{k}:</span> <span className="text-slate-200">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Request Body if POST */}
            {selectedEndpoint.requestBodySample && (
              <div className="text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Request Payload (JSON)</span>
                <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-400 overflow-x-auto mt-1 max-h-48">
                  {JSON.stringify(selectedEndpoint.requestBodySample, null, 2)}
                </pre>
              </div>
            )}

            {/* Response Output */}
            <div className="text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Server Response (Live Preview)</span>
                <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                  Status: 200 OK • 38ms
                </span>
              </div>
              <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-teal-300 overflow-x-auto max-h-60">
                {JSON.stringify(simulatedResponse, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: KOTLIN CODE */}
      {activeTab === 'KOTLIN' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="font-bold text-sm text-white">Android Studio Retrofit Client (Kotlin)</h3>
              <p className="text-[11px] text-slate-400">Ready to copy and paste into your Android Studio project</p>
            </div>
            <button
              onClick={() => copyToClipboard(kotlinSampleCode)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Kotlin Code</span>
            </button>
          </div>

          <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-indigo-300 overflow-x-auto leading-relaxed">
            {kotlinSampleCode}
          </pre>
        </div>
      )}

      {/* TAB 3: MONGOOSE SCHEMAS */}
      {activeTab === 'MONGO' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="font-bold text-sm text-white">MongoDB Mongoose Database Models (Node.js)</h3>
              <p className="text-[11px] text-slate-400">Strict schema validation for multi-tenant GST billing</p>
            </div>
            <button
              onClick={() => copyToClipboard(mongoSchemaCode)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Schema Code</span>
            </button>
          </div>

          <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto leading-relaxed">
            {mongoSchemaCode}
          </pre>
        </div>
      )}
    </div>
  );
};
