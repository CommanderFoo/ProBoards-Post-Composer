/**
* Post Composer
* http://support.proboards.com/user/2671
* Copyright (C) 2014 pixelDepth.net All Rights Reserved.
*/

/*
* TODO:
* 	- When editing post, collect data and parse into recording blocks
*/

$(function(){
	(function(){

		return {

			attack: 0.2,
			release: 0.5,
			type: "sawtooth",
			volume: 1,

			starting_key: 1,
			ending_key: 88,

			context: null,
			oscillator: null,
			gain: null,

			recording: false,
			recordings: {},
			recording_id: 0,
			recordings_count: 0,
			recording_start: 0,

			playback: {},

			key_lookup: {},

			MAX_KEY_SPACE: 3700,

			images: null,

			init: function(){
				if(typeof AudioContext != "undefined" || typeof webkitAudioContext != "undefined"){
					if(typeof webkitAudioContext != "undefined"){
						AudioContext = webkitAudioContext;

						if(!AudioContext.prototype.createGain){
							 AudioContext.prototype.createGain = AudioContext.prototype.createGainNode;
						}

					}

					this.setup();

					if(yootil.location.check.posting() || yootil.location.check.editing()){

						// Main context

						this.context = new AudioContext();
						this.oscillator = this.context.createOscillator();
						this.gain = this.context.createGain();

						this.gain.gain.value = 0;

						this.oscillator.start(0);
						this.oscillator.frequency.value = 440;
						this.oscillator.type = "sawtooth";
						this.oscillator.connect(this.gain);

						this.gain.connect(this.context.destination);

						// Setup playback contexts

						this.setup_playback_contexts();

						this.create_composer();
						this.bind_events();

						this.check_for_recordings();
					}

					if(yootil.location.check.thread() || yootil.location.check.recent_posts() || yootil.location.check.search_results()){
						this.setup_playback_contexts();
						this.create_post_recordings();
						yootil.ajax.after_search(this.create_post_recordings, this);
					}
				}
			},

			setup: function(){
				var plugin = proboards.plugin.get("pixeldepth_post_composer");
				var settings = (plugin && plugin.settings)? plugin.settings : false;

				if(plugin.images){
					this.images = plugin.images;
				}
			},

			bind_events: function(){
				var post_form = (yootil.location.check.editing())? yootil.form.edit_post_form() : yootil.form.post_form();

				if(post_form.attr("class").match(/^form_((thread|post)_(new_edit))/i)){
					var evt = RegExp.$1;
					var self = this;

					post_form.bind("validated", function(){
						yootil.key.get_key("pixeldepth_composer").set_on(evt, null, self.build_recordings_data());
						this.submit();

						return;
					});
				}
			},

			build_recordings_data: function(){
				var data = [];

				for(var r in this.recordings){
					var recording = {

						t: this.recordings[r].type,
						a: this.recordings[r].attack,
						r: this.recordings[r].release,
						v: this.recordings[r].volume,
						k: this.recordings[r].keys

					};

					recording.l = (this.recordings[r].loop)? 1: 0;
					recording.o = (this.recordings[r].offset)? this.recordings[k].offset : 0;

					data.push(recording);
				}

				return data;
			},

			check_for_recordings: function(){
				if(yootil.location.check.editing()){
					if(proboards.dataHash && proboards.dataHash.page && proboards.dataHash.page.post && proboards.dataHash.page.post.id){
						var post_id = proboards.dataHash.page.post.id;
						var recordings = yootil.key.value("pixeldepth_composer", post_id);
						var left = true;

						for(var r = 0; r < recordings.length; r ++){
							recordings[r].type = recordings[r].t;
							recordings[r].loop = recordings[r].l;
							recordings[r].volume = recordings[r].v;
							recordings[r].attack = recordings[r].a;
							recordings[r].release = recordings[r].r;
							recordings[r].offset = recordings[r].o;
							recordings[r].keys = recordings[r].k;

							this.recordings[post_id + "_" + r] = recordings[r];
							this.create_recorded_block(post_id + "_" + r);
							left = false;
						}
					}

					this.update_key_counter();
				}
			},

			create_post_recordings: function(){
				this.recordings = {};
				this.create_octaves();

				var posts = $("table.list tr.post");
				var self = this;

				posts.each(function(){
					var id = $(this).attr("id").split("-")[1];
					var recordings = yootil.key.value("pixeldepth_composer", id);
					var post_player = "<div class='postcomposer-player'>";

					post_player += "<img data-recording='" + id + "' title='A song is attached to this post.  Click to play' src='" + self.images.playsong + "' />";


					post_player += "</div>";

					if(recordings && recordings.length){
						var custom = $(this).find(".mini-profile .postcomposersong");
						var player = $(post_player);

						player.find("img").click(function(){
							if(self.is_playing(id)){
								self.stop_playing(id);
								$(this).attr("src", self.images.play);
							} else {
								self.recordings = {};
								$(".postcomposer-player img").attr("src", self.images.playsong);
								self.play_selected_recordings(recordings, id);
								$(this).attr("src", self.images.stopsong);
							}

						});

						if(custom.length){
							custom.append($(player));
						} else {
							$(this).find(".mini-profile").append(player);
						}
					}
				});
			},

			stop_playing: function(post){
				if(this.recordings){
					if(this.recordings[post + "_0"]){
						this.recordings[post + "_0"].playing = false;
					}

					if(this.recordings[post + "_1"]){
						this.recordings[post + "_1"].playing = false;
					}
				}
			},

			is_playing: function(post){
				if(this.recordings){
					if(this.recordings[post + "_0"]){
						if(this.recordings[post + "_0"].playing){
							return true;
						}
					}

					if(this.recordings[post + "_1"]){
						if(this.recordings[post + "_1"].playing){
							return true;
						}
					}
				}

				return false;
			},

			play_selected_recordings: function(recordings, post_id){
				if(recordings && post_id){
					var left = true;

					for(var r = 0; r < recordings.length; r ++){
						recordings[r].type = recordings[r].t;
						recordings[r].loop = recordings[r].l;
						recordings[r].volume = recordings[r].v;
						recordings[r].attack = recordings[r].a;
						recordings[r].release = recordings[r].r;
						recordings[r].offset = recordings[r].o;
						recordings[r].keys = recordings[r].k;

						this.recordings[post_id + "_" + r] = recordings[r];
						this.play_recording(post_id + "_" + r, left, true);
						left = false;
					}
				}
			},

			// Due to context limitations, we have to reuse existing ones,
			// so create these here now

			setup_playback_contexts: function(){
				this.playback = {

					left: (function(){
						var context = new AudioContext();
						var oscillator = context.createOscillator();
						var gain = context.createGain();

						gain.gain.value = 0;
						oscillator.start(0);
						oscillator.frequency.value = 440;
						oscillator.type = "sawtooth";
						oscillator.connect(gain);

						gain.connect(context.destination);

						return {

							context: context,
							oscillator: oscillator,
							gain: gain

						};

					})(),

					right: (function(){
						var context = new AudioContext();
						var oscillator = context.createOscillator();
						var gain = context.createGain();

						gain.gain.value = 0;
						oscillator.start(0);
						oscillator.frequency.value = 440;
						oscillator.type = "sawtooth";
						oscillator.connect(gain);

						gain.connect(context.destination);

						return {

							context: context,
							oscillator: oscillator,
							gain: gain

						};

					})()

				};
			},

			create_composer: function(){
				this.create_tab();
			},

			create_octaves: function(){
				var start = 27.5;
				var key = 1;
				var total_keys = 88;
				var octaves = [];
				var total_octaves = 0;
				var key_counter = 0;
				var accidental_matches = [1, 3, 6, 8, 10];
				var letters = "ABCDEFG";
				var letter_counter = 0;

				while(total_octaves < 9){
				    var keys = {};
				    var total_keys = (total_octaves == 8)? 1 : ((total_octaves == 0)? 3 : 12);
					var count = 0;

				    while(total_keys){
						this.key_lookup[(key_counter + 1)] = keys[(key_counter + 1)] = {

							key: (key_counter + 1),
							frequency: start,
							accidental: false

						};

						if(total_octaves != 8){
							keys[(key_counter + 1)].accidental = (total_octaves == 0 && count == 1)? true : (total_octaves != 0 && (accidental_matches.indexOf(count) > -1)? true : false);
						}

						if(keys[(key_counter + 1)].accidental){
							keys[(key_counter + 1)].letter = (keys[key_counter] && keys[key_counter].letter) || letters.substr(letter_counter % 7, 1);;
						} else {
							keys[(key_counter + 1)].letter = letters.substr(letter_counter % 7, 1);
							letter_counter ++;
						}

				        start *= Math.pow(2, 1 / 12);
				        total_keys --;
				        key_counter ++;
				        count ++;
				    }

				    octaves[total_octaves] = keys;
				    octaves[total_octaves].total_keys = count;
				    total_octaves ++;
				}

				return octaves;
			},

			play_recording: function(id, left, pre_recorded){
				if(!this.recordings[id]){
					return;
				}

				var self = this;
				var player = (left)? "left" : "right";
				var the_recording = this.recordings[id];
				var first_key = the_recording.keys[0];
				var context = this.playback[player].context;
				var oscillator = this.playback[player].oscillator;
				var gain = this.playback[player].gain;

				oscillator.type = (parseInt(the_recording.type))? this.get_oscillator_type(the_recording.type) : the_recording.type;

				var extra_offset = (this.recordings[id].offset)? (this.recordings[id].offset * 1000) : 0;

				var offset = first_key[0] * 1000;
				var start = performance.now() + offset;
				var end = start + (the_recording.keys[the_recording.keys.length - 1][0] * 1000) + extra_offset + 500;
				var current_key = 0;
				var then = performance.now() + extra_offset;

				this.recordings[id].playing = true;

				var time_start = performance.now();

				var play_back = function(timestamp){
					if((performance.now() + offset) <= end && self.recordings[id] && self.recordings[id].playing){
						var key = the_recording.keys[current_key] || null;

						$("div[data-recording=" + id + "] .recording_playback_time").text(((timestamp - time_start) / 1000).toFixed(2));


						if(key){
							var time = (then + (key[0] * 1000));

							if((performance.now() + offset) >= time){
								current_key ++;

								var now = context.currentTime;
								var freq = self.key_lookup[key[1]].frequency;

								gain.gain.cancelScheduledValues(now);
								oscillator.frequency.setValueAtTime(freq, now);
								gain.gain.setValueAtTime(the_recording.volume, now);
								gain.gain.linearRampToValueAtTime(the_recording.volume, now + the_recording.attack);
								gain.gain.linearRampToValueAtTime(0, now + the_recording.attack + the_recording.release);
							}
						} else {
							cancelAnimationFrame(play_back);
						}

						requestAnimationFrame(play_back);
					} else {
						if(the_recording.loop){
							self.play_recording(id);
						} else {
							if(self.recordings[id]){
								self.recordings[id].playing = false;
							}

							if(pre_recorded){
								var post_id = id.split("_")[0];
								var post = $("tr#post-" + post_id);

								if(post.length){
									post.find(".mini-profile .postcomposer-player img").attr("src", self.images.playsong);
								}
							} else {
								$("div[data-recording=" + id + "] button.play_recording").css("opacity", 1);
								$("div[data-recording=" + id + "] button.stop_recording_play").css("opacity", .5);
							}
						}
					}
				};

				requestAnimationFrame(play_back);
			},

			create_keyboard: function(){
				var keyboard = "<div class='composer_keyboard'>";

				keyboard += "<ul class='piano'>";

				var octaves = this.octaves = this.create_octaves();

				for(var o = 0; o < octaves.length; o ++){
					for(var k in octaves[o]){
						if(k == "total_keys" || octaves[o][k].accidental){
							continue;
						}

						if(octaves[o][k].key >= this.starting_key && octaves[o][k].key <= this.ending_key){
							var accidental = "";
							var letter = octaves[o][k].letter;

							if(octaves[o][k - 1] && octaves[o][k - 1].accidental){
								accidental = "<span data-frequency='" + octaves[o][k - 1].frequency + "' data-key='" + octaves[o][k - 1].key + "'></span>";
							}

							keyboard += "<li><div data-frequency='" + octaves[o][k].frequency + "' data-key='" + octaves[o][k].key + "' class='anchor'><strong>" + letter + "</strong></div>" + accidental + "</li>";
						}
					}
				}

				keyboard += "</ul>";
				keyboard += "</div>";

				return keyboard;
			},

			has_key_space: function(){
				var space = parseInt($("#keys_left_counter").text());

				if(space > 0){
					return true;
				}

				return false;
			},

			update_key_counter: function(){
				var data = 0;
				var space = 0;

				for(var k in this.recordings){
					data += JSON.stringify(this.recordings[k].keys).length;
				}

				space = (this.MAX_KEY_SPACE - data);
				space = (space < 0)? 0 : space;

				$("#keys_left_counter").text(yootil.number_format(space));
			},

			create_recorded_block: function(id){
				if(!this.recordings[id] || !this.recordings[id].keys.length){
					this.recordings_count --;

					if(this.recordings[id]){
						delete self.recordings[self.recording_id];
					}

					return;
				}

				var player = ($(".recordings #recording_one").children().length == 0)? true : false;
				var block_parent = (player)? $(".recordings #recording_one") : $(".recordings #recording_two");
				var type = (player)? "left" : "right";
				var recording_block = "<div data-recording='" + id + "' id='" + type + "'>";

				recording_block += "<div class='recording-controls'>";

				recording_block += "<button type='button' class='play_recording'><img src='" + this.images.play + "' />Play</button>";
				recording_block += "<button type='button' class='stop_recording_play'><img src='" + this.images.stop + "' />Stop</button>";
				recording_block += "<button type='button' class='loop_recording'><img src='" + this.images.loop + "' />Loop</button>";
				recording_block += "</div><div class='delete_recording' title='Delete Recording'><img src='" + this.images.delete + "' /></div>";

				recording_block += "<br  style='clear: both' />";

				recording_block += "<div class='misc_controls'>";

				recording_block += "<span class='recording_type'><select>";

				var selected_type = this.recordings[id].type;
				var options = ["Sawtooth", "Triangle", "Sine", "Square"];
				var counter = 1;

				while(counter < 5){
					var selected = (selected_type == counter)? " selected='selected'" : "";

					recording_block += "<option value='" + counter + "'" + selected + ">" + options[counter - 1] + "</option>";
					counter ++;
				}

				recording_block += "</select></span>";

				recording_block += "<span class='recording_playback_time'>0.00</span>";
				recording_block += "<span class='recordings_slider_offset'><strong>Start Offset:</strong><div class='recording_offset'></div><span class='slider_offset_amount'>0</span></span>";


				recording_block += "</div></div>";


				var self = this;

				block_parent.append($(recording_block));

				block_parent.find("select").change(function(){
					var parent = $(this).parent().parent().parent();
					var id = parent.attr("data-recording");

					self.recordings[id].type = self.get_oscillator_type(this.value);
				});

				block_parent.find(".recording_offset").slider({

                  	value: 0,
                  	min: 0,
                  	max: 60,
                  	step: 1,
                  	slide: function(e, ui){
                  		var parent = $(this).parent().parent();
                  		var id = parent.attr("data-recording");

                  		parent.find("span.slider_offset_amount").text(ui.value);
                  	},

                  	change: function(e, ui){
                  		var parent = $(this).parent().parent();
                  		var id = parent.parent().attr("data-recording");

                  		if(self.recordings[id]){
                  			self.recordings[id].offset = ui.value;
                  		}
                  	}

				});

				block_parent.find("button.play_recording").click(function(){
					var parent = $(this).parent().parent();
					var id = parent.attr("data-recording");

					if(self.recordings[id]){
						var player = (parent.attr("id") == "left")? true : false;

						if(!self.recordings[id].playing){
							self.play_recording(id, player);
							$(this).css("opacity", 0.5);

							$(this).parent().find(".stop_recording_play").css("opacity", 1);
						}
					}
				});

				block_parent.find("button.stop_recording_play").click(function(){
					var id = $(this).parent().parent().attr("data-recording");

					if(self.recordings[id]){
						if(self.recordings[id].playing){
							$(this).parent().find(".play_recording").css("opacity", 1);
							self.recordings[id].playing = self.recordings[id].loop = false;
						}
					}
				});

				block_parent.find("button.loop_recording").click(function(){
					var id = $(this).parent().parent().attr("data-recording");

					if(self.recordings[id]){
						if($(this).hasClass("looping")){
							$(this).removeClass("looping");
							self.recordings[id].loop = false;
						} else {
							$(this).addClass("looping");
							self.recordings[id].loop = true;
						}
					}
				});

				block_parent.find("div.delete_recording").click(function(){
					var id = $(this).parent().attr("data-recording");

					if(self.recordings[id]){
						if(self.recordings[id].playing){
							self.recordings[id].playing = false;
						}

						delete self.recordings[id];
						self.update_key_counter();
						self.recordings_count --;
						$(this).parent().parent().empty();
						$("#postcomposer #control_record").removeClass("recording_disabled");
					}
				});
			},

			get_oscillator_type: function(value){
				var type = "sawtooth";

				switch(parseInt(value)){

					case 1:
						type = "sawtooth";
						break;

					case 2:
						type = "triangle";
						break;

					case 3:
						type = "sine";
						break;

					case 4:
						type = "square";
						break;

				}

				return type;
			},

			create_tab: function(){
				var self = this;
				var tab = $("<li id='menu-item-postcomposer'><a href='#'>Post Composer</a></li>");
				var wysiwyg_tabs = $("ul.wysiwyg-tabs").append(tab);
				var tab_content = this.create_tab_content();

				$("<div id='postcomposer'>" + tab_content + "</div>").hide().insertBefore($("ul.wysiwyg-tabs"));

				$("#postcomposer .piano div, #postcomposer .piano span").mousedown(function(){
					$(this).addClass("active");

					var now = self.context.currentTime;
					var freq = parseFloat($(this).attr("data-frequency"));

					self.gain.gain.cancelScheduledValues(now);
					self.oscillator.frequency.setValueAtTime(freq, now);
					self.gain.gain.setValueAtTime(self.volume, now);
					self.gain.gain.linearRampToValueAtTime(self.volume, now + self.attack);
					self.gain.gain.linearRampToValueAtTime(0, now + self.attack + self.release);

					if(self.recording){
						if(!self.recording_id){
							self.recording_id = "id_" + Math.floor((Math.random() * 1000));

							if(self.recordings[self.recording_id]){
								self.recording_id = "id_" + Math.floor((Math.random() * 100000));
							}

							self.recording_start = parseFloat(now.toFixed(3));

							self.recordings[self.recording_id] = {

								type: self.oscillator.type,
								attack: self.attack,
								release: self.release,
								volume: self.volume,
								keys: []

							};
						}

						if(self.has_key_space()){
							self.recordings[self.recording_id].keys.push([

								parseFloat(now.toFixed(2)) - self.recording_start,
								parseInt($(this).attr("data-key"))

							]);
						}

						self.update_key_counter();
					}
				});

				$("#postcomposer #piano_type").change(function(){
					var value = $(this).val();

					self.oscillator.type = self.get_oscillator_type(value);
				});

				$("#postcomposer .slider div#slider_attack").slider({

                  	value: this.attack,
                  	min: 0.01,
                  	max: 3.00,
                  	step: 0.01,
                  	slide: function(e, ui){
                  		$("#slider-attack-amount").html(ui.value);
                  	},

                  	change: function(e, ui){
                  		self.attack = parseFloat(ui.value);
                  	}

				});

				$("#postcomposer .slider div#slider_release").slider({

                  	value: this.release,
                  	min: 0.04,
                  	max: 3.00,
                  	step: 0.01,
                  	slide: function(e, ui){
                  		$("#slider-release-amount").html(ui.value);
                  	},

                  	change: function(e, ui){
                  		self.release = parseFloat(ui.value);
                  	}

				});

				$("#postcomposer .slider div#slider_volume").slider({

                  	value: this.volume,
                  	min: 0.001,
                  	max: 1,
                  	step: 0.001,
                  	slide: function(e, ui){
                  		$("#slider-volume-amount").html(ui.value);
                  	},

                  	change: function(e, ui){
                  		self.volume = parseFloat(ui.value);
                  	}

				});

				$("#postcomposer .piano div, #postcomposer .piano span").mouseup(function(){
					setTimeout(function(){
						$("#postcomposer .piano div, #postcomposer .piano div").removeClass("active");
					}, 200);
				});

				$("#postcomposer #control_record").click(function(){
					if($(this).hasClass("recording")){
						self.recording = false;
						self.create_recorded_block(self.recording_id);
						self.recording_id = 0;

						$(this).removeClass("recording");

						if(self.recordings_count >= 2){
							$(this).addClass("recording_disabled");
						} else {
							$(this).removeClass("recording_disabled");
						}


					} else {
						if(self.recordings_count < 2){
							self.recordings_count ++;
							self.recording = true;
							$(this).addClass("recording");
						}
					}
				});

				wysiwyg_tabs.find("li").click(function(e){
					e.preventDefault();

					$(this).parent().find("li").removeClass("ui-active");
					$(this).addClass("ui-active");

					self.hide_inactive_tabs($(this));

					var id = $(this).attr("id");
					var selector = "";

					if(id){
						selector = "#" + id.split("menu-item-")[1];
					}

					if(id.match(/bbcode|visual/i)){
						$(".ui-wysiwyg .editors").show();
					} else if($(selector).length){
						$(selector).show();
					}
				});
			},

			hide_inactive_tabs: function(active){
				active.parent().find("li").each(function(){
					var id = $(this).attr("id");

					if(id.match(/bbcode|visual/i)){
						$(".ui-wysiwyg .editors").hide();
					} else {
						if(active.attr("id") == id){
							return;
						}

						var selector = "";

						if(id){
							selector = "#" + id.split("menu-item-")[1];
						}

						if($(selector).length){
							$(selector).hide();
						}
					}
				});
			},

			// TODO: Move inline CSS to stylesheet

			create_tab_content: function(){
				var composer_content = "<div style='border: 1px solid #E6E6E6; height: 360px;'>";

				composer_content += this.create_keyboard();
				composer_content += this.create_controls();
				composer_content += this.create_recordings();

				composer_content += "</div>";

				return composer_content;
			},

			create_controls: function(){
				var controls = "<div class='controls'>";
				var left_controls = "<div class='left-controls'>";

				left_controls += "<button type='button' id='control_record'><img src='" + this.images.record + "' />Record</button>";
				left_controls += "<span class='keys_counter'><strong>Key Space Left:</strong> <span id='keys_left_counter'>" + yootil.number_format(this.MAX_KEY_SPACE) + "</span></span>";

				left_controls += "</div>";

				var right_controls = "<div class='right-controls'>";

				right_controls += "<span class='slider'><strong>Volume:</strong> <div id='slider_volume'></div><span id='slider-volume-amount'>1</span></span>";
				right_controls += "<span class='slider'><strong style='left: 8px;'>Attack:</strong> <div id='slider_attack'></div><span id='slider-attack-amount'>0.20</span></span>";
				right_controls += "<span class='slider'><strong>Release:</strong> <div id='slider_release'></div><span id='slider-release-amount'>0.50</span></span>";

				right_controls += "<select id='piano_type'>";
				right_controls += "<option value='1'>Sawtooth</option>";
				right_controls += "<option value='2'>Triangle</option>";
				right_controls += "<option value='3'>Sine</option>";
				right_controls += "<option value='4'>Square</option>";
				right_controls += "</select>";

				right_controls += "</div>";

				controls += left_controls + right_controls + "</div>";


				return controls;
			},

			create_recordings: function(){
				var recordings = "<br style='clear: both' /><div class='recordings'>";
				var style = "style='background-image: url(";

				recordings += "<div id='recording_one' class='recording_one' " + style + this.images.note1 + ");'></div>";
				recordings += "<div id='recording_two' class='recording_two' " + style + this.images.note2 + ");'></div>";

				recordings += "</div>";

				return recordings;
			}

		};

	})().init();
});