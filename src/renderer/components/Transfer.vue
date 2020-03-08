<template>
  <form :class="outputs === null ? 'is-loading is-loading-lg' : ''">
    <b-form-group
      id="address-group"
      :label="$t('transfer.target_address')"
      label-for="target"
      :state="addressState"
      :invalid-feedback="invalidAddressFeedback"
      :valid-feedback="validAddressFeedback"
  >
      <b-form-input id="target" :state="addressState" v-model.trim="targetAddress"
                    v-on:change="prepareTx"
                    v-on:input="prepareTx"
                    v-on:paste="paste"></b-form-input>
    </b-form-group>
    <b-form-group
      id="address-group"
      :label="$t('resource.amount')"
      label-for="amount"
      :invalid-feedback="invalidAmountFeedback"
      :valid-feedback="validAmountFeedback"
      :state="amountState"
      >
      <b-input-group size="lg">
        <b-form-input id="amount" :state="amountState"
                      v-model.number="amount"
                      v-on:change="prepareTx"
                      v-on:input="prepareTx"></b-form-input>
        <div class="input-group-append">
          <div class="input-group-text">
            <i class="nuls"></i>
          </div>
        </div>
      </b-input-group>
      <b-form-text id="amountHelp">
        {{$t('resource.available_balance')}}
        <b-link @click="set_amount(total_outputs_value/100000000)">
          {{total_outputs_value/100000000}}<i class="nuls"></i>
        </b-link>
      </b-form-text>
    </b-form-group>

    <b-form-group
      id="remark-group"
      :label="$t('resource.remark')"
      label-for="remark"
      >
      <b-input-group>
        <b-form-input type="text" :placeholder="$t('resource.remark')" :maxlength="100"
             v-on:change="prepareTx"
             v-on:input="prepareTx" v-model="remark" />
        <div class="input-group-append">
          <div class="input-group-text" v-text="(100 - remark.length)"></div>
        </div>
      </b-input-group>
    </b-form-group>

    <!--sign :tx="tx" :account="account" :api_server="settings.api_server" @message-broadcasted="broadcasted" /-->
    <b-button class="btn btn-lg btn-block btn-primary mb-3" type="button" v-on:click="sign" :disabled="tx==null">
      {{$t('actions.sign_transaction')}}
    </b-button>
    <!--b-button @click="sign">sign</b-button-->
  </form>
</template>
<script>
import axios from 'axios'
import {private_key_to_public_key,
  address_from_hash,
  hash_from_address,
  public_key_to_hash,
  get_outputs_for_sum
} from 'nulsworldjs/src/model/data.js'
import nuls from 'nuls-sdk-js/src/index.js'
import util from 'nuls-sdk-js/src/test/api/util.js'
import http from 'nuls-sdk-js/src/test/api/https.js'

import Transaction from 'nulsworldjs/src/model/transaction.js'
import Sign from './Sign.vue'
import { mapState } from 'vuex'

let ipcpRenderer = null
if (!process.env.IS_WEB) {
  ipcpRenderer = require('electron-ipcp').ipcpRenderer
}

export default {
  name: 'transfer',
  props: ['address'],
  data () {
    return {
      'targetAddress': '',
      'amount': 0.0,
      'tx': null,
      'fee': 0,
      'remark': '',
      'outputs': null,
      'stats': {},
      'last_sync_height': 0,
      'total_outputs_value': 0
    }
  },
  computed: {
    addressState () {
      //if (this.targetAddress.length != 32) { return false }
      //return true
      if (!this.targetAddress.startsWith("NULSd")) { return false }          
      return true
    },
    invalidAddressFeedback () {
      return this.$t('resource.invalid_target')
    },
    validAddressFeedback () {
      return this.$t('resource.valid_target')
    },
    amountState () {
      if (!this.amount) { return false }
      if (typeof this.amount === 'string' || this.amount instanceof String) { return false }
      if (this.amount < 0.001) { return false }
      if (this.amount > (this.total_outputs_value / 100000000)) {
        this.amount = this.total_outputs_value / 100000000
        return true
      }

      return true
    },
    validAmountFeedback () {
      return this.$t('resource.valid_amount', {amount: this.amount})
    },
    invalidAmountFeedback () {
      if (this.amount < 0.001) {
        return this.$t('resource.min_amount', {min: 0.001})
      }
      if (this.amount > (this.stats.available_value / 100000000)) {
        return this.$t('resource.insuficient_balance', {
          balance: this.stats.available_value / 100000000
        })
      }

      return ''
    },
    ...mapState([
      // map this.count to store.state.count
      'accounts',
      'settings'
    ])
  },
  methods: {
    /* prepareTx () {
      if (!(this.amountState && this.addressState)) {
        this.tx = null
        return
      }
      this.signed_tx = null
      console.info('prepare1')

      let target_value = this.amount * 100000000
      let {in: selected_inputs,
        val: current_value} = get_outputs_for_sum((this.amount + 0.1) * 100000000, this.outputs)

      let tx = Transaction.from_dict(
        {'inputs': selected_inputs,
          'outputs': [
            {address: hash_from_address(this.targetAddress),
              value: target_value},
            {address: hash_from_address(this.$route.params.address),
              value: current_value - target_value} // no fee applied yet
          ],
          'type': 2,
          'scriptSig': '',
          'remark': this.remark
        }
      )

      let fee = tx.calculate_fee()
      this.fee = fee
      let change = current_value - target_value - fee
      if (change > 0) {
        tx.outputs[1].na = change
      } else {
        tx.outputs[0].na += change
        this.amount = tx.outputs[0].na / 100000000
        tx.outputs.splice(1, 1)
      }
      this.tx = tx
    }, */
    async prepareTx () {      
      let fromAddress = this.$route.params.address 
      let balanceInfo = await http.postComplete('https://public1.nuls.io/', 'getAccountBalance', [1, 1, 1, fromAddress])
        .then((response) => {
          return {'balance': response.result.balance, 'nonce': response.result.nonce};
        })
        .catch((error) => {
          return {success: false, data: error};
        });

      let transferInfo = {
        fromAddress: fromAddress,
        toAddress: this.targetAddress,
        assetsChainId: 1,
        assetsId: 1,
        amount: this.amount * 100000000,
        fee: 100000
      };

      let inOrOutputs = await util.inputsOrOutputs(transferInfo, balanceInfo, 2);
      let tAssemble = [];
      //console.info(inOrOutputs.data)
      if (inOrOutputs.success) {
        tAssemble = await nuls.transactionAssemble(inOrOutputs.data.inputs, inOrOutputs.data.outputs, this.remark, 2);
        //console.info(tAssemble)
        let newFee = util.countFee(tAssemble, 1);
        if (transferInfo.fee !== newFee) {
          transferInfo.fee = newFee;
          inOrOutputs = await util.inputsOrOutputs(transferInfo, balanceInfo, 2);
          tAssemble = await nuls.transactionAssemble(inOrOutputs.data.inputs, inOrOutputs.data.outputs, this.remark, 2);
          //console.info(tAssemble)
        } 
      } else {
        console.info(inOrOutputs.data)
      }
      this.tx = tAssemble
    },
    async sign () {
      /*if (this.account.type === 'ledger') {

      } */
      let hex = this.tx.txSerialize().toString('hex')
      let scriptSig = null
      if (!process.env.IS_WEB) {
        scriptSig = await ipcpRenderer.sendMain(
          'ledger_get_scriptsig', 1, hex)
        console.info(scriptSig)
      } else {
        const {ledger_get_scriptsig} = require('../ledger_browser')
        scriptSig = await ledger_get_scriptsig(1, hex)

      }
    },
    paste () {
      this.prepareTx()
      return true
    },
    async getOutputs () {
      let address = this.$route.params.address
      //https://nuls.world/addresses/stats?addresses[]=NULSd6Hgb7ja7JEhy5uTpT4GASV1XsiiP9bLc
      let response = await axios.get(`${this.settings.api_server}/addresses/stats`, {
        params: {
          addresses: [address]
        }
      })
      //console.info(response)
      let stats = response.data.unspent_info[address]
      this.$set(this, 'last_sync_height', response.data.last_height)
      this.$set(this, 'total_outputs_value', stats.available_value)
      this.$set(this, 'stats', stats)
    },
    broadcasted (msg) {
      Object.assign(this.$data, this.$options.data())
      this.outputs = null
      this.$emit('message-broadcasted', msg)
    },
    set_amount (amount) {
      this.amount = amount
    }
  },
  props: ['account'],
  components: {
    Sign
  },
  async created () {
    await this.getOutputs()
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>

</style>
